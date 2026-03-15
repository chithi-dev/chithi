<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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

	interface RoomFileEntry {
		key: string;
		filename: string;
		size: number;
		uploaded_at: string;
		download_url: string;
	}

	interface RoomOut {
		id: string;
		name: string;
		expires_at: string;
		files: RoomFileEntry[];
		host_count: number;
	}

	type ReceiveState =
		| { type: 'idle' }
		| {
				type: 'streaming';
				key: string;
				filename: string;
				size: number;
				received: number;
				chunks: ArrayBuffer[];
		  };

	interface UploadEntry {
		file: File;
		progress: Tween<number>;
		status: 'pending' | 'uploading' | 'done' | 'error';
		entry?: RoomFileEntry;
	}

	interface DownloadedFile {
		key: string;
		filename: string;
		size: number;
		objectUrl?: string;
	}

	interface RemoteUpload {
		key: string;
		filename: string;
		size: number;
		uploadedBytes: number;
		progress: Tween<number>;
	}

	let room_id = $derived(page.params.room_id);

	function fileDownloadUrl(fileKey: string): string {
		return `${REVERSE_ROOMS_URL}/${room_id}/files/${fileKey}/download`;
	}

	// Host token is passed via URL fragment hash so it never leaks in share links.
	// Format: #<token>
	let hostToken = $state<string | null>(null);
	let isHost = $derived(hostToken !== null);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash.slice(1);
		if (hash) {
			hostToken = hash;
		}
	});

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
	let overallProgress = $state(new Tween(0, { duration: 400, easing: cubicOut }));

	// Client streaming
	let receiveState = $state<ReceiveState>({ type: 'idle' });
	let downloadedFiles = $state<DownloadedFile[]>([]);

	// WebSocket
	let ws = $state<WebSocket | null>(null);
	let wsConnected = $state(false);
	let remoteUploads = $state<RemoteUpload[]>([]);

	// Copy state
	let copiedShareLink = $state(false);
	let copiedFileKeys = $state(new Set<string>());
	let copiedInviteLink = $state(false);
	let isInviting = $state(false);

	let shareUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/reverse/${room_id}`
			: `/reverse/${room_id}`
	);

	let totalUploadSize = $derived(pendingFiles.reduce((s, f) => s + f.size, 0));
	let completedUploads = $derived(uploads.filter((u) => u.status === 'done').length);
	let totalUploads = $derived(uploads.length);

	let streamProgress = $derived(
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
			if (!res.ok) {
				loadStatus = 'error';
				return;
			}
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
		if (ws) ws.close();
		let wsUrl = `${REVERSE_WS_URL}/${room_id}`;
		if (hostToken) wsUrl += `?host_token=${encodeURIComponent(hostToken)}`;
		const socket = new WebSocket(wsUrl);
		ws = socket;
		wsConnected = false;

		socket.onopen = () => {
			wsConnected = true;
		};
		socket.onclose = () => {
			wsConnected = false;
			ws = null;
		};
		socket.onerror = () => {
			wsConnected = false;
			toast.error('WebSocket connection error');
		};

		socket.onmessage = (ev) => {
			if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
				if (!isHost) handleBinaryChunk(ev.data);
				return;
			}

			let msg: Record<string, unknown>;
			try {
				msg = JSON.parse(ev.data as string);
			} catch {
				return;
			}

			const type = msg.type as string;

			if (type === 'snapshot') {
				const r = msg.room as RoomOut;
				room = r;
				roomFiles = [...r.files];
				hostCount = r.host_count ?? 1;
			} else if (type === 'host_count') {
				hostCount = msg.count as number;
			} else if (type === 'upload_start') {
				const key = msg.upload_key as string;
				if (!remoteUploads.find((u) => u.key === key)) {
					remoteUploads = [
						...remoteUploads,
						{
							key,
							filename: msg.filename as string,
							size: msg.size as number,
							uploadedBytes: 0,
							progress: new Tween(0, { duration: 300, easing: cubicOut })
						}
					];
				}
			} else if (type === 'upload_progress') {
				const key = msg.upload_key as string;
				const bytes = msg.uploaded_bytes as number;
				const upload = remoteUploads.find((u) => u.key === key);
				if (upload) {
					upload.uploadedBytes = bytes;
					const pct = upload.size > 0 ? (bytes / upload.size) * 100 : 0;
					upload.progress.target = pct;
				}
			} else if (type === 'upload_cancelled') {
				const key = msg.upload_key as string;
				remoteUploads = remoteUploads.filter((u) => u.key !== key);
			} else if (type === 'file_added') {
				const file = msg.file as RoomFileEntry;
				if (!roomFiles.find((f) => f.key === file.key)) {
					roomFiles = [...roomFiles, file];
				}
				remoteUploads = remoteUploads.filter((u) => u.key !== file.key);
			} else if (type === 'file_start' && !isHost) {
				receiveState = {
					type: 'streaming',
					key: msg.key as string,
					filename: msg.filename as string,
					size: msg.size as number,
					received: 0,
					chunks: []
				};
			} else if (type === 'file_end' && !isHost && receiveState.type === 'streaming') {
				const { key, filename, size, chunks } = receiveState;
				const blob = new Blob(chunks);
				const objectUrl = URL.createObjectURL(blob);
				downloadedFiles = [...downloadedFiles, { key, filename, size, objectUrl }];
				receiveState = { type: 'idle' };
				toast.success(`Received: ${filename}`);
			} else if (type === 'file_error') {
				receiveState = { type: 'idle' };
				toast.error(`File error: ${msg.detail}`);
			} else if (type === 'file_removed') {
				const removedKey = msg.key as string;
				roomFiles = roomFiles.filter((f) => f.key !== removedKey);
				downloadedFiles = downloadedFiles.filter((f) => f.key !== removedKey);
			} else if (type === 'room_destroyed') {
				toast.info('The host has closed the room.');
				cleanup();
				goto('/reverse');
				return;
			}
		};
	}

	async function handleBinaryChunk(data: ArrayBuffer | Blob) {
		const buf = data instanceof Blob ? await data.arrayBuffer() : data;
		if (receiveState.type !== 'streaming') return;
		const chunk = new Uint8Array(buf);
		receiveState.chunks.push(buf);
		receiveState.received += chunk.byteLength;
	}

	function addFiles(selected: FileList | null) {
		if (!selected) return;
		pendingFiles = [...pendingFiles, ...Array.from(selected)];
	}

	function removePendingFile(index: number) {
		pendingFiles = pendingFiles.filter((_, i) => i !== index);
	}

	async function uploadAll() {
		if (!room || pendingFiles.length === 0) return;
		isUploading = true;
		overallProgress = new Tween(0, { duration: 400, easing: cubicOut });

		const batch: UploadEntry[] = pendingFiles.map((f) => ({
			file: f,
			progress: new Tween(0, { duration: 300, easing: cubicOut }),
			status: 'pending' as const
		}));
		uploads = [...uploads, ...batch];
		pendingFiles = [];

		for (const entry of batch) {
			entry.status = 'uploading';
			uploads = uploads;

			try {
				const fileEntry = await uploadFileXhr(entry.file, (pct) => {
					entry.progress.target = pct;
					const done = uploads.filter((u) => u.status === 'done').length;
					overallProgress.target = ((done + pct / 100) / batch.length) * 100;
					uploads = uploads;
				});
				entry.status = 'done';
				entry.entry = fileEntry;
				if (!roomFiles.find((f) => f.key === fileEntry.key)) {
					roomFiles = [...roomFiles, fileEntry];
				}
			} catch (e: unknown) {
				entry.status = 'error';
				toast.error(
					`Upload failed for ${entry.file.name}: ${e instanceof Error ? e.message : String(e)}`
				);
			}
			uploads = uploads;
		}

		overallProgress.target = 100;
		isUploading = false;
	}

	function uploadFileXhr(file: File, onProgress: (pct: number) => void): Promise<RoomFileEntry> {
		return new Promise((resolve, reject) => {
			const fd = new FormData();
			fd.append('file', file, file.name);

			const xhr = new XMLHttpRequest();
			xhr.open('POST', `${REVERSE_ROOMS_URL}/${room_id}/upload`);
			xhr.withCredentials = true;
			if (hostToken) xhr.setRequestHeader('X-Host-Token', hostToken);

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						resolve(JSON.parse(xhr.responseText) as RoomFileEntry);
					} catch {
						reject(new Error('Invalid server response'));
					}
				} else {
					let detail = `HTTP ${xhr.status}`;
					try {
						detail = (JSON.parse(xhr.responseText) as { detail: string }).detail ?? detail;
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
		await navigator.clipboard.writeText(shareUrl);
		copiedShareLink = true;
		setTimeout(() => (copiedShareLink = false), 2000);
	}

	async function inviteHost() {
		if (!hostToken) return;
		isInviting = true;
		try {
			const res = await fetch(`${REVERSE_ROOMS_URL}/${room_id}/hosts`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'X-Host-Token': hostToken }
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
			}
			const data = (await res.json()) as { host_token: string };
			const inviteUrl = `${window.location.origin}/reverse/${room_id}#${data.host_token}`;
			await navigator.clipboard.writeText(inviteUrl);
			copiedInviteLink = true;
			toast.success('Host invite link copied to clipboard');
			setTimeout(() => (copiedInviteLink = false), 3000);
		} catch (e: unknown) {
			toast.error(`Failed to create invite: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			isInviting = false;
		}
	}

	async function copyDownloadLink(key: string, url: string) {
		await navigator.clipboard.writeText(url);
		copiedFileKeys = new Set([...copiedFileKeys, key]);
		setTimeout(() => {
			copiedFileKeys = new Set([...copiedFileKeys].filter((k) => k !== key));
		}, 2000);
	}

	function leaveRoom() {
		cleanup();
		goto('/reverse');
	}

	function cleanup() {
		if (ws) ws.close();
		downloadedFiles.forEach((f) => {
			if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
		});
	}

	onMount(loadRoom);
	onDestroy(cleanup);
</script>

<!-- Loading -->
{#if loadStatus === 'loading'}
	<div class="flex min-h-[70vh] items-center justify-center">
		<div class="flex items-center gap-3 text-muted-foreground">
			<LoaderCircle class="h-6 w-6 animate-spin" />
			<span>Loading room…</span>
		</div>
	</div>

	<!-- Not found -->
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

	<!-- Error -->
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

	<!-- Room -->
{:else if loadStatus === 'loaded' && room}
	<div class="mx-auto max-w-3xl space-y-6 p-4">
		<!-- Header -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{room.name}</h1>
					<Badge variant={isHost ? 'default' : 'secondary'}>
						{isHost ? 'Host' : 'Guest'}
					</Badge>
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Badge variant="outline" class="gap-1">
									<Users class="h-3 w-3" />
									{hostCount}
									{hostCount === 1 ? 'host' : 'hosts'}
								</Badge>
							</Tooltip.Trigger>
							<Tooltip.Content>
								{hostCount} host{hostCount === 1 ? '' : 's'} can upload to this room
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

				{#if isHost}
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
				{/if}

				<Button variant="outline" size="sm" onclick={leaveRoom}>
					<ArrowLeft class="mr-1 h-4 w-4" />
					Leave
				</Button>
			</div>
		</div>

		<Separator />

		<!-- Host: file picker + upload -->
		{#if isHost}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2 text-base">
						<Upload class="h-4 w-4" />
						Upload Files
					</CardTitle>
					<CardDescription>
						Files you upload are pushed to all connected clients via WebSocket. A permanent download
						link is also generated for each file.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- Drop zone -->
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

					<!-- Pending queue -->
					{#if pendingFiles.length > 0}
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
					{/if}

					<!-- Overall progress -->
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

					<!-- Per-file rows -->
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
									{#if u.status === 'done' && u.entry}
										{@const fileKey = u.entry.key}
										{@const downloadUrl = u.entry.download_url}
										<div class="mt-1 flex items-center gap-2">
											<span class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
												>{downloadUrl}</span
											>
											<Button
												size="sm"
												variant="ghost"
												class="h-6 shrink-0 px-2 text-xs"
												onclick={() => copyDownloadLink(fileKey, downloadUrl)}
											>
												{#if copiedFileKeys.has(fileKey)}
													<Check class="mr-1 h-3 w-3 text-green-500" />
													Copied
												{:else}
													<Copy class="mr-1 h-3 w-3" />
													Copy
												{/if}
											</Button>
											<a href={downloadUrl} target="_blank" rel="noopener noreferrer">
												<Button size="sm" variant="outline" class="h-6 shrink-0 px-2 text-xs">
													<Download class="mr-1 h-3 w-3" />
													Download
												</Button>
											</a>
										</div>
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
		{/if}

		<!-- Remote uploads (other hosts) -->
		{#if remoteUploads.length > 0}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2 text-base">
						<Upload class="h-4 w-4" />
						In-flight Uploads
					</CardTitle>
					<CardDescription>
						Other hosts are currently uploading files to this room.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						{#each remoteUploads as u}
							<div class="space-y-1 rounded-md border px-3 py-2">
								<div class="flex items-center gap-2">
									<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
									<span class="min-w-0 flex-1 truncate text-sm">{u.filename}</span>
									<span class="shrink-0 text-xs text-muted-foreground">
										{formatFileSize(u.uploadedBytes)} / {formatFileSize(u.size)}
									</span>
									<LoaderCircle class="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
								</div>
								<Progress value={u.progress.current} max={100} class="h-1" />
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Client: active stream progress -->
		{#if !isHost && receiveState.type === 'streaming'}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2 text-base">
						<LoaderCircle class="h-4 w-4 animate-spin" />
						Receiving: {receiveState.filename}
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-2">
					<div class="flex justify-between text-xs">
						<span class="text-muted-foreground">
							{formatFileSize(receiveState.received)} / {formatFileSize(receiveState.size)}
						</span>
						<span class="text-muted-foreground">{streamProgress.toFixed(0)}%</span>
					</div>
					<Progress value={streamProgress} max={100} />
				</CardContent>
			</Card>
		{/if}

		<!-- Shared files list -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center justify-between text-base">
					<span class="flex items-center gap-2">
						<Users class="h-4 w-4" />
						{isHost ? 'Shared Files' : 'Available Files'}
					</span>
					<Badge variant="outline">{roomFiles.length}</Badge>
				</CardTitle>
				{#if !isHost}
					<CardDescription>
						Files are streamed to you automatically. Use the download links to save them — links
						remain valid until the room expires.
					</CardDescription>
				{/if}
			</CardHeader>
			<CardContent>
				{#if roomFiles.length === 0}
					<div class="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
						<FileIcon class="h-8 w-8 opacity-40" />
						<span>{isHost ? 'No files uploaded yet.' : 'Waiting for host to share files…'}</span>
					</div>
				{:else}
					<div class="space-y-2">
						{#each roomFiles as f}
							{@const downloaded = downloadedFiles.find((d) => d.key === f.key)}
							<div class="rounded-md border px-3 py-2">
								<div class="flex items-center gap-3">
									<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">{f.filename}</p>
										<p class="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
									</div>

									<!-- Copy permanent link -->
									<Tooltip.Provider>
										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													size="sm"
													variant="ghost"
													class="h-7 shrink-0 px-2"
													onclick={() => copyDownloadLink(f.key, fileDownloadUrl(f.key))}
												>
													{#if copiedFileKeys.has(f.key)}
														<Check class="h-3.5 w-3.5 text-green-500" />
													{:else}
														<Copy class="h-3.5 w-3.5" />
													{/if}
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content>Copy permanent download link</Tooltip.Content>
										</Tooltip.Root>
									</Tooltip.Provider>

									<!-- Permanent HTTP download -->
									{#if f.key}
										<a href={fileDownloadUrl(f.key)} target="_blank" rel="noopener noreferrer">
											<Button size="sm" variant="outline" class="h-7 shrink-0 gap-1 px-2 text-xs">
												<Download class="h-3.5 w-3.5" />
												Download
											</Button>
										</a>
									{/if}

									<!-- Client: save streamed blob -->
									{#if !isHost && downloaded?.objectUrl}
										<a
											href={downloaded.objectUrl}
											download={downloaded.filename}
											rel="noopener noreferrer"
										>
											<Button size="sm" variant="default" class="h-7 shrink-0 gap-1 px-2 text-xs">
												<Check class="h-3.5 w-3.5" />
												Saved
											</Button>
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Client: received blobs -->
		{#if !isHost && downloadedFiles.length > 0}
			<Card>
				<CardHeader>
					<CardTitle class="text-base">Received Files</CardTitle>
					<CardDescription>
						Files streamed to you this session. "Save" downloads from browser memory, "Permalink"
						fetches from the server link — which remains valid until the room expires.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						{#each downloadedFiles as df}
							<div class="flex items-center gap-3 rounded-md border px-3 py-2">
								<Check class="h-4 w-4 shrink-0 text-green-500" />
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{df.filename}</p>
									<p class="text-xs text-muted-foreground">{formatFileSize(df.size)}</p>
								</div>
								{#if df.objectUrl}
									<a href={df.objectUrl} download={df.filename}>
										<Button size="sm" variant="default" class="h-7 shrink-0 gap-1 px-2 text-xs">
											<Download class="h-3.5 w-3.5" />
											Save
										</Button>
									</a>
								{/if}
								{#if df.key}
									<a href={fileDownloadUrl(df.key)} target="_blank" rel="noopener noreferrer">
										<Button size="sm" variant="outline" class="h-7 shrink-0 gap-1 px-2 text-xs">
											<Link class="h-3.5 w-3.5" />
											Permalink
										</Button>
									</a>
								{/if}
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}
	</div>
{/if}
