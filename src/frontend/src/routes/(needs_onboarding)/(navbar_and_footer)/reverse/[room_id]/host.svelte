<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { toast } from 'svelte-sonner';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip/index';
	import {
		Upload,
		Download,
		Copy,
		Check,
		Link,
		Plus,
		X,
		Users,
		FileIcon,
		LoaderCircle,
		ArrowLeft,
		Wifi,
		WifiOff,
		UserPlus
	} from 'lucide-svelte';
	import { formatFileSize } from '#functions/bytes';
	import { REVERSE_ROOMS_URL, REVERSE_WS_URL } from '#consts/backend';
	import {
		createZipStream,
		createEncryptedStream,
		createDecryptedStream
	} from '#functions/streams';
	import { base64urlToBytes } from '#functions/encryption';
	import { resolve } from '$app/paths';
	import { extractEncryptionKey, extractHostToken } from './utils';
	import type {
		DownloadedFile,
		ReceiveState,
		RemoteUpload,
		RoomFileEntry,
		RoomOut,
		UploadEntry
	} from './types';

	let { room_id }: { room_id: string } = $props();
	let hostToken = $state('');
	let roomKey = $state<string | null>(null);

	$effect(() => {
		const hash = $page.url.hash.slice(1);
		if (hash) {
			hostToken = extractHostToken(hash);
			roomKey = extractEncryptionKey(hash);
		}
	});

	const fileDownloadUrl = (fileKey: string) =>
		`${REVERSE_ROOMS_URL}/${room_id}/files/${fileKey}/download`;
	const downloadPageHref = (fileKey: string) =>
		resolve(`/download/${fileKey}${roomKey ? `#${roomKey}` : ''}`);

	type LoadStatus = 'loading' | 'not_found' | 'error' | 'loaded';
	let loadStatus = $state<LoadStatus>('loading');
	let room = $state<RoomOut | null>(null);
	let roomFiles = $state<RoomFileEntry[]>([]);
	let hostCount = $state(1);

	// Host upload
	let pendingFiles = $state<File[]>([]);
	let fileInput = $state<HTMLInputElement>();
	let uploads = $state<UploadEntry[]>([]);
	let isUploading = $state(false);
	const overallProgress = new Tween(0, { duration: 400, easing: cubicOut });

	// Client streaming
	let receiveState = $state<ReceiveState>({ type: 'idle' });
	let downloadedFiles = $state<DownloadedFile[]>([]);

	// WebSocket
	let ws = $state<WebSocket | null>(null);
	let wsConnected = $state(false);
	let remoteUploads = $state<RemoteUpload[]>([]);

	// Copy/UI states
	let copiedShareLink = $state(false);
	let copiedFileKeys = $state(new Set<string>());
	let copiedInviteLink = $state(false);
	let isInviting = $state(false);

	const shareUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/reverse/${room_id}`
			: `/reverse/${room_id}`
	);

	const totalUploadSize = $derived(pendingFiles.reduce((s, f) => s + f.size, 0));
	const completedUploads = $derived(uploads.filter((u) => u.status === 'done').length);
	const totalUploads = $derived(uploads.length);

	const streamProgress = $derived(
		receiveState.type === 'streaming' && receiveState.size > 0
			? (receiveState.received / receiveState.size) * 100
			: 0
	);

	async function loadRoom() {
		loadStatus = 'loading';
		try {
			const res = await fetch(`${REVERSE_ROOMS_URL}/${room_id}`, { credentials: 'include' });
			if (res.status === 404) {
				loadStatus = 'not_found';
				return;
			}
			if (!res.ok) throw new Error();

			const data: RoomOut = await res.json();
			room = data;
			roomFiles = [...data.files];
			hostCount = data.host_count ?? 1;
			loadStatus = 'loaded';
			connectWebSocket();
		} catch {
			loadStatus = 'error';
		}
	}

	function connectWebSocket() {
		ws?.close();
		const socket = new WebSocket(
			`${REVERSE_WS_URL}/${room_id}?host_token=${encodeURIComponent(hostToken)}`
		);
		ws = socket;

		socket.onopen = () => (wsConnected = true);
		socket.onclose = () => {
			wsConnected = false;
			ws = null;
		};
		socket.onerror = () => {
			wsConnected = false;
			toast.error('WebSocket connection error');
		};

		socket.onmessage = async (ev) => {
			if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
				handleBinaryChunk(ev.data);
				return;
			}

			try {
				const msg = JSON.parse(ev.data);
				const { type } = msg;

				switch (type) {
					case 'snapshot': {
						const r = msg.room as RoomOut;
						room = r;
						roomFiles = [...r.files];
						hostCount = r.host_count ?? 1;
						remoteUploads =
							r.active_uploads?.map((u) => ({
								key: u.upload_key,
								filename: u.filename,
								size: u.size,
								uploadedBytes: u.uploaded_bytes,
								progress: new Tween(u.size > 0 ? (u.uploaded_bytes / u.size) * 100 : 0, {
									duration: 300,
									easing: cubicOut
								})
							})) ?? [];
						break;
					}
					case 'host_count':
						hostCount = msg.count;
						break;
					case 'connection_counts':
						if (room) {
							room.connected_hosts = msg.hosts;
							room.connected_guests = msg.guests;
						}
						break;
					case 'upload_start': {
						const key = msg.upload_key;
						if (!remoteUploads.some((u) => u.key === key)) {
							remoteUploads = [
								...remoteUploads,
								{
									key,
									filename: msg.filename,
									size: msg.size,
									uploadedBytes: 0,
									progress: new Tween(0, { duration: 300, easing: cubicOut })
								}
							];
						}
						break;
					}
					case 'upload_progress': {
						const upload = remoteUploads.find((u) => u.key === msg.upload_key);
						if (upload) {
							upload.uploadedBytes = msg.uploaded_bytes;
							upload.progress.target = upload.size > 0 ? (msg.uploaded_bytes / upload.size) * 100 : 0;
						}
						break;
					}
					case 'upload_cancelled':
						remoteUploads = remoteUploads.filter((u) => u.key !== msg.upload_key);
						break;
					case 'file_added': {
						const file = msg.file as RoomFileEntry;
						if (!roomFiles.some((f) => f.key === file.key)) {
							roomFiles = [...roomFiles, file];
						}
						remoteUploads = remoteUploads.filter((u) => u.key !== file.key);
						break;
					}
					case 'file_removed':
						roomFiles = roomFiles.filter((f) => f.key !== msg.key);
						downloadedFiles = downloadedFiles.filter((f) => f.key !== msg.key);
						break;
					case 'room_destroyed':
						toast.info('The room has been destroyed.');
						cleanup();
						goto('/reverse');
						break;
				}
			} catch {
				/* ignore invalid JSON */
			}
		};
	}

	async function handleBinaryChunk(data: ArrayBuffer | Blob) {
		if (receiveState.type !== 'streaming') return;
		const buf = data instanceof Blob ? await data.arrayBuffer() : data;
		receiveState.chunks.push(buf as any);
		receiveState.received += buf.byteLength;
	}

	function addFiles(selected: FileList | null) {
		if (selected) pendingFiles = [...pendingFiles, ...Array.from(selected)];
	}

	const removePendingFile = (index: number) => {
		pendingFiles = pendingFiles.filter((_, i) => i !== index);
	};

	async function uploadAll() {
		if (!room || pendingFiles.length === 0) return;
		if (!roomKey) {
			toast.error('Cannot upload to an unencrypted room.');
			return;
		}
		isUploading = true;
		overallProgress.set(0, { duration: 0 });

		const batch: UploadEntry[] = pendingFiles.map((f) => ({
			file: f,
			progress: new Tween(0, { duration: 300, easing: cubicOut }),
			status: 'pending'
		}));
		uploads = [...uploads, ...batch];
		pendingFiles = [];

		const ikm = base64urlToBytes(roomKey);

		for (const entry of batch) {
			entry.status = 'uploading';
			uploads = [...uploads];

			try {
				const zipStream = await createZipStream([entry.file]);
				const { stream: encryptedStream } = await createEncryptedStream(
					zipStream,
					undefined,
					undefined,
					undefined,
					ikm
				);

				const encryptedBlob = await new Response(encryptedStream).blob();
				const filename = `${entry.file.name}.zip`;

				const fileEntry = await uploadFileXhr(encryptedBlob, filename, (pct) => {
					entry.progress.target = pct;
					const done = uploads.filter((u) => u.status === 'done').length;
					overallProgress.target = ((done + pct / 100) / batch.length) * 100;
					uploads = [...uploads];
				});
				entry.status = 'done';
				entry.entry = fileEntry;
				if (!roomFiles.some((f) => f.key === fileEntry.key)) {
					roomFiles = [...roomFiles, fileEntry];
				}
			} catch (e: any) {
				entry.status = 'error';
				toast.error(`Upload failed for ${entry.file.name}: ${e.message || String(e)}`);
			}
			uploads = [...uploads];
		}

		overallProgress.target = 100;
		isUploading = false;
	}

	function uploadFileXhr(
		file: Blob,
		filename: string,
		onProgress: (pct: number) => void
	): Promise<RoomFileEntry> {
		return new Promise((resolve, reject) => {
			const fd = new FormData();
			fd.append('file', file, filename);

			const xhr = new XMLHttpRequest();
			xhr.open('POST', `${REVERSE_ROOMS_URL}/${room_id}/upload`);
			xhr.withCredentials = true;
			xhr.setRequestHeader('X-Host-Token', hostToken);

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						resolve(JSON.parse(xhr.responseText));
					} catch {
						reject(new Error('Invalid server response'));
					}
				} else {
					let detail = `HTTP ${xhr.status}`;
					try {
						detail = JSON.parse(xhr.responseText).detail || detail;
					} catch {
						/* ignore */
					}
					reject(new Error(detail));
				}
			};
			xhr.onerror = () => reject(new Error('Network error'));
			xhr.send(fd);
		});
	}

	async function copyShareLink() {
		const url = roomKey ? `${shareUrl}#${roomKey}` : shareUrl;
		await navigator.clipboard.writeText(url);
		copiedShareLink = true;
		setTimeout(() => (copiedShareLink = false), 2000);
	}

	async function inviteHost() {
		isInviting = true;
		try {
			const res = await fetch(`${REVERSE_ROOMS_URL}/${room_id}/hosts`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'X-Host-Token': hostToken }
			});
			if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

			const { host_token } = await res.json();
			const inviteUrl = `${window.location.origin}/reverse/${room_id}#${host_token}${roomKey ? `:${roomKey}` : ''}`;
			await navigator.clipboard.writeText(inviteUrl);
			copiedInviteLink = true;
			toast.success('Host invite link copied to clipboard');
			setTimeout(() => (copiedInviteLink = false), 3000);
		} catch (e: any) {
			toast.error(`Failed to create invite: ${e.message || String(e)}`);
		} finally {
			isInviting = false;
		}
	}

	async function copyDownloadLink(key: string, url: string) {
		await navigator.clipboard.writeText(url);
		copiedFileKeys = new Set([...copiedFileKeys, key]);
		setTimeout(() => {
			copiedFileKeys.delete(key);
			copiedFileKeys = new Set(copiedFileKeys);
		}, 2000);
	}

	function leaveRoom() {
		cleanup();
		goto('/reverse');
	}

	async function downloadFile(f: RoomFileEntry) {
		const downloaded = downloadedFiles.find((d) => d.key === f.key);
		if (downloaded?.objectUrl) {
			const a = document.createElement('a');
			a.href = downloaded.objectUrl;
			a.download = f.filename;
			a.click();
			return;
		}

		if (receiveState.type !== 'idle') {
			toast.error('Another file is currently being received.');
			return;
		}

		receiveState = {
			type: 'streaming',
			key: f.key,
			filename: f.filename,
			size: f.size,
			received: 0,
			chunks: []
		};

		try {
			const res = await fetch(fileDownloadUrl(f.key), {
				credentials: 'include',
				headers: { 'X-Host-Token': hostToken }
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			if (!res.body) throw new Error('No response body');

			let stream = res.body as any;
			if (roomKey) {
				const { stream: decryptedStream } = await createDecryptedStream(stream, roomKey);
				stream = decryptedStream;
			}

			const reader = stream.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				receiveState.chunks.push(value);
				receiveState.received += value.byteLength;
			}

			const objectUrl = URL.createObjectURL(new Blob(receiveState.chunks));
			downloadedFiles = [...downloadedFiles, { ...f, objectUrl }];
			receiveState = { type: 'idle' };

			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = f.filename;
			a.click();
		} catch (e: any) {
			receiveState = { type: 'idle' };
			toast.error(`Download failed: ${e.message || String(e)}`);
		}
	}

	function cleanup() {
		ws?.close();
		downloadedFiles.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl));
	}

	onMount(loadRoom);
	onDestroy(cleanup);

	const getDisplayFilename = (filename: string) =>
		filename.endsWith('.zip') ? filename.slice(0, -4) : filename;
</script>

{#if loadStatus === 'loading'}
	<div class="flex min-h-[70vh] items-center justify-center">
		<div class="flex items-center gap-3 text-muted-foreground">
			<LoaderCircle class="h-6 w-6 animate-spin" />
			<span>Loading room…</span>
		</div>
	</div>
{:else if loadStatus === 'not_found'}
	<div class="flex min-h-[70vh] items-center justify-center p-4">
		<div class="space-y-4 text-center">
			<h2 class="text-2xl font-bold">Room Not Found</h2>
			<p class="text-muted-foreground">This room doesn't exist or has expired.</p>
			<Button onclick={() => goto('/reverse')}>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Reverse Share
			</Button>
		</div>
	</div>
{:else if loadStatus === 'error'}
	<div class="flex min-h-[70vh] items-center justify-center p-4">
		<div class="space-y-4 text-center">
			<h2 class="text-2xl font-bold">Something went wrong</h2>
			<p class="text-muted-foreground">Failed to load the room. Please try again.</p>
			<div class="flex justify-center gap-2">
				<Button variant="outline" onclick={() => goto('/reverse')}>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Go Back
				</Button>
				<Button onclick={loadRoom}>Retry</Button>
			</div>
		</div>
	</div>
{:else if loadStatus === 'loaded' && room}
	<div class="mx-auto max-w-3xl space-y-6 p-4">
		<!-- Header -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{room.name}</h1>
					<Badge variant="default">Host</Badge>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Badge variant="outline" class="gap-1">
									<Users class="h-3 w-3" />
									{room.connected_hosts}
									{room.connected_hosts === 1 ? 'host' : 'hosts'}
								</Badge>
							</Tooltip.Trigger>
							<Tooltip.Content>
								{room.connected_hosts} host{room.connected_hosts === 1 ? '' : 's'} online
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#if wsConnected}
									<Wifi class="h-4 w-4 text-muted-foreground" />
								{:else}
									<WifiOff class="h-4 w-4 text-destructive" />
								{/if}
							</Tooltip.Trigger>
							<Tooltip.Content>
								{wsConnected ? 'WebSocket connected' : 'Disconnected'}
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
				<p class="text-sm text-muted-foreground">
					Expires: {new Date(room.expires_at).toLocaleString()}
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="outline" size="sm" onclick={copyShareLink}>
								{#if copiedShareLink}
									<Check class="mr-1 h-4 w-4 text-green-500" />
									Copied!
								{:else}
									<Link class="mr-1 h-4 w-4" />
									Share Link
								{/if}
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>{shareUrl}</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="outline" size="sm" onclick={inviteHost} disabled={isInviting}>
								{#if copiedInviteLink}
									<Check class="mr-1 h-4 w-4 text-green-500" />
									Copied!
								{:else if isInviting}
									<LoaderCircle class="mr-1 h-4 w-4 animate-spin" />
									Inviting…
								{:else}
									<UserPlus class="mr-1 h-4 w-4" />
									Invite Host
								{/if}
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>Generate and copy a host invite link</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Button variant="outline" size="sm" onclick={leaveRoom}>
					<ArrowLeft class="mr-1 h-4 w-4" />
					Leave
				</Button>
			</div>
		</div>

		<Separator />

		<!-- Upload Section -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2 text-base">
					<Upload class="h-4 w-4" />
					Upload Files
				</CardTitle>
				<CardDescription>
					Files you upload are pushed to all connected clients via WebSocket.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div
					class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-10 transition-colors hover:border-primary/60"
					onclick={() => fileInput?.click()}
					onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
					role="button"
					tabindex="0"
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						addFiles(e.dataTransfer?.files ?? null);
					}}
				>
					<Plus class="mb-2 h-8 w-8 text-muted-foreground" />
					<p class="text-sm text-muted-foreground">Click or drop files here</p>
					<input
						bind:this={fileInput}
						type="file"
						multiple
						class="hidden"
						onchange={(e) => addFiles((e.currentTarget as HTMLInputElement).files)}
					/>
				</div>

				{#if pendingFiles.length > 0}
					<ScrollArea class="max-h-64 w-full rounded-md border p-2">
						<div class="space-y-2">
							<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Queued — {formatFileSize(totalUploadSize)}
							</p>
							{#each pendingFiles as file, i}
								<div class="flex items-center gap-3 rounded-md border px-3 py-2">
									<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
									<span class="min-w-0 flex-1 truncate text-sm">{file.name}</span>
									<span class="shrink-0 text-xs text-muted-foreground"
										>{formatFileSize(file.size)}</span
									>
									<button
										class="shrink-0 text-muted-foreground hover:text-destructive"
										onclick={() => removePendingFile(i)}
										aria-label="Remove"
									>
										<X class="h-4 w-4" />
									</button>
								</div>
							{/each}
						</div>
					</ScrollArea>
				{/if}

				{#if isUploading || (uploads.length > 0 && completedUploads < totalUploads)}
					<div class="space-y-1">
						<div class="flex justify-between text-xs">
							<span class="text-muted-foreground"
								>Overall — {completedUploads}/{totalUploads} files</span
							>
							<span class="text-muted-foreground">{overallProgress.current.toFixed(0)}%</span>
						</div>
						<Progress value={overallProgress.current} max={100} />
					</div>
				{/if}

				{#if uploads.length > 0}
					<div class="space-y-2">
						{#each uploads as u}
							<div class="space-y-1 rounded-md border px-3 py-2">
								<div class="flex items-center gap-2">
									<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
									<span class="min-w-0 flex-1 truncate text-sm">{u.file.name}</span>
									<span class="shrink-0 text-xs text-muted-foreground"
										>{formatFileSize(u.file.size)}</span
									>
									{#if u.status === 'done'}
										<Check class="h-4 w-4 shrink-0 text-green-500" />
									{:else if u.status === 'error'}
										<X class="h-4 w-4 shrink-0 text-destructive" />
									{:else if u.status === 'uploading'}
										<LoaderCircle class="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
									{/if}
								</div>
								{#if u.status === 'uploading' || u.status === 'pending'}
									<Progress value={u.progress.current} max={100} class="h-1" />
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
			<CardFooter>
				<Button
					onclick={uploadAll}
					disabled={pendingFiles.length === 0 || isUploading}
					class="w-full"
				>
					{#if isUploading}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
						Uploading…
					{:else}
						<Upload class="mr-2 h-4 w-4" />
						Upload {pendingFiles.length > 0
							? `${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`
							: 'Files'}
					{/if}
				</Button>
			</CardFooter>
		</Card>

		<!-- Shared Files List -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between text-base">
					<span class="flex items-center gap-2">
						<Users class="h-4 w-4" />
						Shared Files
					</span>
					<Badge variant="outline">{roomFiles.length + remoteUploads.length}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if roomFiles.length === 0 && remoteUploads.length === 0}
					<div class="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
						<FileIcon class="h-8 w-8 opacity-40" />
						<span>No files uploaded yet.</span>
					</div>
				{:else}
					<ScrollArea class="max-h-96 w-full rounded-md border p-2">
						<div class="space-y-2">
							{#each remoteUploads as u}
								<div class="space-y-1 rounded-md border bg-muted/20 px-3 py-2">
									<div class="flex items-center gap-2">
										<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
										<span class="min-w-0 flex-1 truncate text-sm"
											>{getDisplayFilename(u.filename)}</span
										>
										<span class="shrink-0 text-xs text-muted-foreground">
											{formatFileSize(u.uploadedBytes)} / {formatFileSize(u.size)}
										</span>
										<LoaderCircle class="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
									</div>
									<Progress value={u.progress.current} max={100} class="h-1" />
								</div>
							{/each}

							{#each roomFiles as f}
								{@const downloaded = downloadedFiles.find((d) => d.key === f.key)}
								{@const isStreaming =
									receiveState.type === 'streaming' && receiveState.key === f.key}
								{@const displayName = getDisplayFilename(f.filename)}
								<div class="rounded-md border px-3 py-2">
									<div class="flex items-center gap-3">
										<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<p class="truncate text-sm font-medium">
													{displayName}
												</p>
												{#if downloaded}
													<Badge
														variant="outline"
														class="h-4 border-green-200 bg-green-50 px-1 text-[10px] text-green-600 uppercase"
													>
														Saved
													</Badge>
												{/if}
											</div>
											<p class="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
										</div>

										{#if isStreaming}
											<div class="flex items-center gap-2 text-xs text-muted-foreground">
												<span class="animate-pulse">Receiving…</span>
												<span class="font-mono">{streamProgress.toFixed(0)}%</span>
											</div>
										{/if}

										<div class="flex items-center gap-1">
											<Button
												size="sm"
												variant="ghost"
												class="h-7 shrink-0 px-2"
												onclick={() => copyDownloadLink(f.key, downloadPageHref(f.key))}
											>
												{#if copiedFileKeys.has(f.key)}
													<Check class="h-3.5 w-3.5 text-green-500" />
												{:else}
													<Copy class="h-3.5 w-3.5" />
												{/if}
											</Button>

											{#if downloaded}
												<Button
													size="sm"
													variant="default"
													class="h-7 shrink-0 gap-1 px-2 text-xs"
													onclick={() => downloadFile(f)}
													disabled={receiveState.type === 'streaming' && receiveState.key !== f.key}
												>
													<Download class="h-3.5 w-3.5" />
													Save
												</Button>
											{:else}
												<Button
													size="sm"
													variant="outline"
													class="h-7 shrink-0 gap-1 px-2 text-xs"
													onclick={() => downloadFile(f)}
													disabled={receiveState.type === 'streaming' && receiveState.key !== f.key}
												>
													<Download class="h-3.5 w-3.5" />
													Download
												</Button>
											{/if}

											<a
												href={downloadPageHref(f.key)}
												class="inline-flex h-7 shrink-0 items-center gap-1 px-2 text-xs"
											>
												<Link class="h-3.5 w-3.5" />
												<span>Download Page</span>
											</a>
										</div>
									</div>
									{#if isStreaming}
										<Progress value={streamProgress} max={100} class="mt-2 h-1" />
									{/if}
								</div>
							{/each}
						</div>
					</ScrollArea>
				{/if}
			</CardContent>
		</Card>
	</div>
{/if}
