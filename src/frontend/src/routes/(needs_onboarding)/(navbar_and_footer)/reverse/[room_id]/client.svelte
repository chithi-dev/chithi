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
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Progress } from '$lib/components/ui/progress';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Tooltip from '$lib/components/ui/tooltip/index';
	import {
		Download,
		Copy,
		Check,
		Link,
		Users,
		FileIcon,
		LoaderCircle,
		ArrowLeft,
		Wifi,
		WifiOff,
		Zap,
		MousePointerClick
	} from 'lucide-svelte';
	import { formatFileSize } from '#functions/bytes';
	import { REVERSE_ROOMS_URL, REVERSE_WS_URL } from '#consts/backend';
	import { createDecryptedStream } from '#functions/streams';
	import { resolve } from '$app/paths';
	import { extractEncryptionKey } from './utils';

	interface RoomFileEntry {
		key: string;
		filename: string;
		size: number;
		uploaded_at: string;
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
				chunks: BlobPart[];
		  };

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

	let { room_id }: { room_id: string } = $props();
	let roomKey = $state<string | null>(null);

	$effect(() => {
		const hash = $page.url.hash.slice(1);
		if (hash) {
			roomKey = extractEncryptionKey(hash);
		}
	});

	function fileDownloadUrl(fileKey: string): string {
		return `${REVERSE_ROOMS_URL}/${room_id}/files/${fileKey}/download`;
	}

	function downloadPageHref(fileKey: string): string {
		return resolve(`/download/${fileKey}${roomKey ? `#${roomKey}` : ''}`);
	}

	type LoadStatus = 'loading' | 'not_found' | 'error' | 'loaded';
	let loadStatus = $state<LoadStatus>('loading');
	let room = $state<RoomOut | null>(null);
	let roomFiles = $state<RoomFileEntry[]>([]);
	let hostCount = $state(1);

	// Client streaming
	let receiveState = $state<ReceiveState>({ type: 'idle' });
	let downloadedFiles = $state<DownloadedFile[]>([]);

	type DownloadPreference = 'eager' | 'manual' | null;
	let downloadPreference = $state<DownloadPreference>(null);

	$effect(() => {
		if (downloadPreference === 'eager' && receiveState.type === 'idle') {
			const next = roomFiles.find((f) => !downloadedFiles.some((d) => d.key === f.key));
			if (next) {
				downloadFile(next);
			}
		}
	});

	// WebSocket
	let ws = $state<WebSocket | null>(null);
	let wsConnected = $state(false);
	let remoteUploads = $state<RemoteUpload[]>([]);

	// Copy state
	let copiedShareLink = $state(false);
	let copiedFileKeys = $state(new Set<string>());

	let shareUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/reverse/${room_id}`
			: `/reverse/${room_id}`
	);

	let streamProgress = $derived(
		receiveState.type === 'streaming' && receiveState.size > 0
			? (receiveState.received / receiveState.size) * 100
			: 0
	);

	// Encryption key prompt state
	let showKeyPrompt = $state(false);
	let keyInput = $state('');

	function submitKey() {
		const k = keyInput.trim();
		if (!k) {
			toast.error('Please enter an encryption key');
			return;
		}
		roomKey = k;
		showKeyPrompt = false;
		toast.success('Encryption key set');
		// After user provides key, load the room data and connect
		loadRoom();
	}

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
			// If we don't already have a room key from the URL/hash, prompt the user
			if (!roomKey) showKeyPrompt = true;
			connectWebSocket();
		} catch {
			loadStatus = 'error';
		}
	}

	function connectWebSocket() {
		if (ws) ws.close();
		let wsUrl = `${REVERSE_WS_URL}/${room_id}`;
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

		socket.onmessage = async (ev) => {
			if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
				handleBinaryChunk(ev.data);
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
			} else if (type === 'file_start') {
				if (downloadPreference === 'eager' && receiveState.type === 'idle') {
					receiveState = {
						type: 'streaming',
						key: msg.key as string,
						filename: msg.filename as string,
						size: msg.size as number,
						received: 0,
						chunks: []
					};
				}
			} else if (type === 'file_end' && receiveState.type === 'streaming') {
				const { key, filename, size, chunks } = receiveState;

				let finalBlob: Blob;
				if (roomKey) {
					try {
						const encryptedBlob = new Blob(chunks);
						const { stream: decryptedStream } = await createDecryptedStream(
							encryptedBlob.stream() as any,
							roomKey
						);
						const decryptedBlob = await new Response(decryptedStream as any).blob();
						finalBlob = decryptedBlob;
					} catch (e) {
						toast.error(`Decryption failed for ${filename}`);
						finalBlob = new Blob(chunks);
					}
				} else {
					finalBlob = new Blob(chunks);
				}

				const objectUrl = URL.createObjectURL(finalBlob);
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
		receiveState.chunks.push(buf as any);
		receiveState.received += chunk.byteLength;
	}

	async function copyShareLink() {
		const url = roomKey ? `${shareUrl}#${roomKey}` : shareUrl;
		await navigator.clipboard.writeText(url);
		copiedShareLink = true;
		setTimeout(() => (copiedShareLink = false), 2000);
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
			const res = await fetch(fileDownloadUrl(f.key), { credentials: 'include' });

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			if (!res.body) throw new Error('No response body');

			let streamWithProgress: ReadableStream<Uint8Array> = res.body as any;
			if (roomKey) {
				const { stream: decryptedStream } = await createDecryptedStream(res.body as any, roomKey);
				streamWithProgress = decryptedStream;
			}

			const reader = streamWithProgress.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) {
					receiveState.chunks.push(value as any);
					receiveState.received += value.byteLength;
				}
			}

			const blob = new Blob(receiveState.chunks);
			const objectUrl = URL.createObjectURL(blob);
			downloadedFiles = [
				...downloadedFiles,
				{ key: f.key, filename: f.filename, size: f.size, objectUrl }
			];
			receiveState = { type: 'idle' };

			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = f.filename;
			a.click();
		} catch (e: unknown) {
			receiveState = { type: 'idle' };
			toast.error(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	function cleanup() {
		if (ws) ws.close();
		downloadedFiles.forEach((f) => {
			if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
		});
	}

	// Utility to display filename (strip .zip if present)
	function getDisplayFilename(filename: string): string {
		return filename.endsWith('.zip') ? filename.slice(0, -4) : filename;
	}

	onMount(() => {
		// Re-check hash on mount (ensure key from URL is captured)
		const hash = $page.url.hash.slice(1);
		if (hash) {
			const parts = hash.split(':');
			if (parts.length > 1) {
				roomKey = parts[1];
			} else if (parts[0]) {
				roomKey = parts[0];
			}
		}
		if (roomKey) {
			loadRoom();
		} else {
			// Ask for key first, then loadRoom after submission
			showKeyPrompt = true;
		}
	});
	onDestroy(cleanup);
</script>

{#if showKeyPrompt}
	<div class="flex min-h-[70vh] items-center justify-center p-4">
		<div class="w-full max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<Download class="h-5 w-5" />
						Enter Room Key
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						<Label for="room-key">Room Key</Label>
						<Input
							id="room-key"
							type="password"
							placeholder="Paste room key here"
							bind:value={keyInput}
							onkeydown={(e) => e.key === 'Enter' && submitKey()}
						/>
					</div>
					<p class="text-sm text-muted-foreground">
						This key is required to decrypt files sent to this room.
					</p>
				</CardContent>
				<CardFooter class="flex gap-2">
					<Button variant="outline" onclick={() => goto('/reverse')}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Back
					</Button>
					<Button onclick={submitKey} class="flex-1">Enter Key</Button>
				</CardFooter>
			</Card>
		</div>
	</div>
{:else if loadStatus === 'loading'}
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
	{#if downloadPreference === null}
		<div class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center p-4">
			<div class="mb-8 space-y-2 text-center">
				<h2 class="text-3xl font-bold tracking-tight">How should we handle downloads?</h2>
				<p class="text-lg text-muted-foreground">
					Choose how you want to receive files from the host.
				</p>
			</div>

			<div class="grid w-full gap-6 sm:grid-cols-2">
				<Card
					class="relative cursor-pointer border-2 border-primary bg-primary/5 transition-all hover:border-primary/50 hover:shadow-lg"
					onclick={() => (downloadPreference = 'eager')}
				>
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<Badge class="bg-primary px-3 py-1 text-primary-foreground shadow-md">Recommended</Badge
						>
					</div>
					<CardHeader class="flex flex-col items-center pt-8 pb-2 text-center">
						<div class="mb-3 rounded-full bg-primary/20 p-4">
							<Zap class="h-8 w-8 text-primary" />
						</div>
						<CardTitle class="text-xl">Eager Download</CardTitle>
					</CardHeader>
					<CardContent class="text-center text-muted-foreground">
						Files are automatically downloaded as soon as they are shared. Perfect for real-time
						collaboration.
					</CardContent>
					<CardFooter class="justify-center pb-6">
						<Button class="w-full">Select Eager</Button>
					</CardFooter>
				</Card>

				<Card
					class="cursor-pointer border-2 border-transparent transition-all hover:border-primary/50 hover:shadow-lg"
					onclick={() => (downloadPreference = 'manual')}
				>
					<CardHeader class="flex flex-col items-center pt-8 pb-2 text-center">
						<div class="mb-3 rounded-full bg-muted p-4">
							<MousePointerClick class="h-8 w-8 text-muted-foreground" />
						</div>
						<CardTitle class="text-xl">Manual Download</CardTitle>
					</CardHeader>
					<CardContent class="text-center text-muted-foreground">
						Review shared files first and choose which ones to download. Best for limited bandwidth.
					</CardContent>
					<CardFooter class="justify-center pb-6">
						<Button variant="outline" class="w-full">Select Manual</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	{:else}
		<div class="mx-auto max-w-3xl space-y-6 p-4">
			<!-- Header -->
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<h1 class="text-2xl font-bold">{room.name}</h1>
						<Badge variant="secondary">Guest</Badge>
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
									{#if wsConnected}
										WebSocket connected
									{:else}
										Disconnected
									{/if}
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

					<Button variant="outline" size="sm" onclick={leaveRoom}>
						<ArrowLeft class="mr-1 h-4 w-4" />
						Leave
					</Button>
				</div>
			</div>

			<Separator />

			<!-- Available Files -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center justify-between text-base">
						<span class="flex items-center gap-2">
							<Users class="h-4 w-4" />
							Available Files
						</span>
						<Badge variant="outline">{roomFiles.length + remoteUploads.length}</Badge>
					</CardTitle>
					<CardDescription>
						Files are streamed to you automatically. Once received, they are saved to your browser
						memory for instant access.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{#if roomFiles.length === 0 && remoteUploads.length === 0}
						<div class="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
							<FileIcon class="h-8 w-8 opacity-40" />
							<span>Waiting for host to share files…</span>
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
														disabled={receiveState.type === 'streaming' &&
															receiveState.key !== f.key}
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
														disabled={receiveState.type === 'streaming' &&
															receiveState.key !== f.key}
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
{/if}
