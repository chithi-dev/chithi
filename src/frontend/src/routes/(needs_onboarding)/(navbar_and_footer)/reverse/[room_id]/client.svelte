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
	} from '@lucide/svelte';
	import { formatFileSize } from '#functions/bytes';
	import { Api } from '#consts/backend';
	import { createDecryptedStream } from '#functions/streams';
	import { resolve } from '$app/paths';
	import { extractEncryptionKey } from './utils';
	import { get_display_filename, handle_binary_chunk } from './functions';
	import type { DownloadedFile, ReceiveState, RemoteUpload, RoomOut } from './types';
	import { useWsReconnect } from './ws-reconnect.svelte';

	let { room_id }: { room_id: string } = $props();
	let roomKey = $derived(extractEncryptionKey(page.url.hash.slice(1)));

	const downloadPageHref = (fileKey: string) =>
		resolve(`/download/${fileKey}${roomKey ? `#${roomKey}` : ''}`);

	type LoadStatus = 'loading' | 'not_found' | 'error' | 'loaded';
	let loadStatus = $state<LoadStatus>('loading');
	let room = $state<RoomOut | null>(null);
	let roomFiles = $state<any[]>([]);
	let hostCount = $state(1);

	// Client streaming
	let receiveState = $state<ReceiveState>({ type: 'idle' });
	let downloadedFiles = $state<DownloadedFile[]>([]);
	let decryptionProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let isDecrypting = $state(false);

	type DownloadPreference = 'eager' | 'manual' | null;
	let downloadPreference = $state<DownloadPreference>(null);

	$effect(() => {
		if (downloadPreference === 'eager' && receiveState.type === 'idle') {
			const next = roomFiles.find((f) => !downloadedFiles.some((d) => d.key === f.key));
			if (next) downloadFile(next);
		}
	});

	// Remote uploads (from hosts)
	let remoteUploads = $state<Array<{
		key: string;
		filename: string;
		size: number;
		uploadedBytes: number;
		progress: Tween<number>;
	}>>([]);

	// UI states
	let copiedShareLink = $state(false);
	let copiedFileKeys = $state(new Set<string>());
	let showKeyPrompt = $state(false);
	let keyInput = $state('');

	const shareUrl = $derived(
		typeof window !== 'undefined'
			? `${window.location.origin}/reverse/${room_id}`
			: `/reverse/${room_id}`
	);

	const streamProgress = $derived(
		receiveState.type === 'streaming' && receiveState.size > 0
			? Math.min((receiveState.received / receiveState.size) * 100, 100)
			: 0
	);

	const isAnyStreaming = $derived(receiveState.type === 'streaming');
	const isAnyProcessing = $derived(receiveState.type === 'processing');
	const currentTransferKey = $derived(
		receiveState.type === 'streaming' || receiveState.type === 'processing'
			? receiveState.key
			: null
	);

	function onSnapshot(roomData: Record<string, unknown>) {
		if (roomData.files && Array.isArray(roomData.files)) {
			remoteUploads = [];
		}
		hostCount = typeof roomData.host_count === 'number' ? roomData.host_count : 1;
	}

	function onHostCount(count: number) {
		hostCount = count;
	}

	function onConnectionCounts(hosts: number, guests: number) {
		if (room) {
			room.connected_hosts = hosts;
			room.connected_guests = guests;
		}
	}

	function onUploadStart(entry: RemoteUpload) {
		if (!remoteUploads.some((u) => u.key === entry.key)) {
			remoteUploads = [...remoteUploads, entry];
		}
	}

	function onUploadProgress(upload_key: string, uploaded_bytes: number) {
		const upload = remoteUploads.find((u) => u.key === upload_key);
		if (upload) {
			upload.uploadedBytes = uploaded_bytes;
			upload.progress.target = upload.size > 0 ? Math.min((uploaded_bytes / upload.size) * 100, 100) : 0;
		}
	}

	function onUploadCancelled(upload_key: string) {
		remoteUploads = remoteUploads.filter((u) => u.key !== upload_key);
	}

	function onFileAdded(file: RoomOut['files'][number]) {
		const key = (file as any).key;
		if (!roomFiles.some((f: any) => f.key === key)) {
			roomFiles = [...roomFiles, file];
		}
		remoteUploads = remoteUploads.filter((u) => u.key !== key);
	}

	function onFileEnd(key: string) {
		if (receiveState.type !== 'streaming' || receiveState.key !== key) return;
		if (downloadPreference === 'manual') return; // eager-only auto-download

		const { filename, size, chunks } = receiveState;
		receiveState = { type: 'processing', key, filename, size };

		console.debug('[reverse/client] file_end for', key, 'filename=', filename, 'chunks=', chunks.length, 'expected_size=', size);
		(async () => {
			try {
				let finalBlob = new Blob(chunks);
				if (roomKey) {
					isDecrypting = true;
					decryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
					const { stream: decryptedStream } = await createDecryptedStream(
						finalBlob.stream() as any, roomKey, undefined, finalBlob.size,
						(processed, total) => { if (total && total > 0) decryptionProgress.target = Math.min(100, Math.round((processed / total) * 100)); }
					);
					finalBlob = await new Response(decryptedStream as any).blob();
				}
				const objectUrl = URL.createObjectURL(finalBlob);
				downloadedFiles = [...downloadedFiles, { key, filename, size, objectUrl }];
				toast.success(`Received: ${filename}`);

				const a = document.createElement('a');
				a.href = objectUrl;
				a.download = filename;
				a.click();
			} catch {
				toast.error(`Decryption failed for ${filename}`);
			} finally {
				receiveState = { type: 'idle' };
				isDecrypting = false;
			}
		})();
	}

	function onFileError(detail: string, _key: string) {
		if (receiveState.type === 'streaming') receiveState = { type: 'idle' };
		toast.error(`File error: ${detail}`);
	}

	function onFileRemoved(key: string) {
		roomFiles = roomFiles.filter((f: any) => f.key !== key);
		downloadedFiles = downloadedFiles.filter((d) => d.key !== key);
	}

	function onRoomDestroyed() {
		toast.info('The host has closed the room.');
		wsReconnect.close();
		goto('/reverse');
	}

	const wsReconnect = useWsReconnect({
		get_room_id: () => room_id,
		get_receive_state: () => receiveState,
		get_downloaded_files: () => downloadedFiles,
		get_room_key: () => roomKey,
		onSnapshot,
		onHostCount,
		onConnectionCounts,
		onUploadStart,
		onUploadProgress,
		onUploadCancelled,
		onFileAdded,
		onFileEnd,
		onFileError,
		onFileRemoved,
		onRoomDestroyed
	});

	function submitKey() {
		const k = keyInput.trim();
		if (!k) { toast.error('Please enter an encryption key'); return; }
		window.location.hash = k;
		showKeyPrompt = false;
		toast.success('Encryption key set');
		loadRoom();
	}

	async function loadRoom() {
		loadStatus = 'loading';
		try {
			const res = await fetch(Api.REVERSE.ROOM_DETAIL(room_id), { credentials: 'include' });
			if (res.status === 404) { loadStatus = 'not_found'; return; }
			if (!res.ok) throw new Error();

			const data: RoomOut = await res.json();
			room = data;
			roomFiles = structuredClone(data.files);
			hostCount = data.host_count ?? 1;
			loadStatus = 'loaded';

			if (!roomKey) showKeyPrompt = true;
		} catch { loadStatus = 'error'; }
	}

	async function copyShareLink() {
		const url = roomKey ? `${shareUrl}#${roomKey}` : shareUrl;
		await navigator.clipboard.writeText(url);
		copiedShareLink = true;
		setTimeout(() => (copiedShareLink = false), 2000);
	}

	async function copyDownloadLink(key: string) {
		const url = downloadPageHref(key);
		await navigator.clipboard.writeText(url);
		copiedFileKeys = new Set([...copiedFileKeys, key]);
		setTimeout(() => { copiedFileKeys.delete(key); copiedFileKeys = new Set(copiedFileKeys); }, 2000);
	}

	function leaveRoom() {
		wsReconnect.close();
		downloadedFiles.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl));
		goto('/reverse');
	}

	async function downloadFile(f: RoomOut['files'][number]) {
		const key = (f as any).key;
		const downloaded = downloadedFiles.find((d) => d.key === key);
		if (downloaded?.objectUrl) {
			const a = document.createElement('a');
			a.href = downloaded.objectUrl;
			a.download = f.filename;
			a.click();
			return;
		}

		if (receiveState.type !== 'idle') { toast.error('Another file is currently being received.'); return; }

		receiveState = { type: 'streaming', key, filename: f.filename, size: f.size, received: 0, chunks: [] };
		wsReconnect.send({ type: 'request_file', key });
	}

	onMount(() => {
		if (roomKey) loadRoom();
		else showKeyPrompt = true;
	});
	onDestroy(() => { downloadedFiles.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl)); });
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
						<Input id="room-key" type="password" placeholder="Paste room key here" bind:value={keyInput} onkeydown={(e) => e.key === 'Enter' && submitKey()} />
					</div>
					<p class="text-sm text-muted-foreground">This key is required to decrypt files sent to this room.</p>
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
				<p class="text-lg text-muted-foreground">Choose how you want to receive files from the host.</p>
			</div>

			<div class="grid w-full gap-6 sm:grid-cols-2">
				<Card class="relative cursor-pointer border-2 border-primary bg-primary/5 transition-all hover:border-primary/50 hover:shadow-lg" onclick={() => (downloadPreference = 'eager')}>
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<Badge class="bg-primary px-3 py-1 text-primary-foreground shadow-md">Recommended</Badge>
					</div>
					<CardHeader class="flex flex-col items-center pt-8 pb-2 text-center">
						<div class="mb-3 rounded-full bg-primary/20 p-4"><Zap class="h-8 w-8 text-primary" /></div>
						<CardTitle class="text-xl">Eager Download</CardTitle>
					</CardHeader>
					<CardContent class="text-center text-muted-foreground">Files are automatically downloaded as soon as they are shared. Perfect for real-time collaboration.</CardContent>
					<CardFooter class="justify-center pb-6"><Button class="w-full">Select Eager</Button></CardFooter>
				</Card>

				<Card class="cursor-pointer border-2 border-transparent transition-all hover:border-primary/50 hover:shadow-lg" onclick={() => (downloadPreference = 'manual')}>
					<CardHeader class="flex flex-col items-center pt-8 pb-2 text-center">
						<div class="mb-3 rounded-full bg-muted p-4"><MousePointerClick class="h-8 w-8 text-muted-foreground" /></div>
						<CardTitle class="text-xl">Manual Download</CardTitle>
					</CardHeader>
					<CardContent class="text-center text-muted-foreground">Review shared files first and choose which ones to download. Best for limited bandwidth.</CardContent>
					<CardFooter class="justify-center pb-6"><Button variant="outline" class="w-full">Select Manual</Button></CardFooter>
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
									<Badge variant="outline" class="gap-1"><Users class="h-3 w-3" />{room.connected_hosts}{room.connected_hosts === 1 ? 'host' : 'hosts'}</Badge>
								</Tooltip.Trigger>
								<Tooltip.Content>{room.connected_hosts} host{room.connected_hosts === 1 ? '' : 's'} online</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#if wsReconnect.connected}
										<Wifi class="h-4 w-4 text-muted-foreground" />
									{:else}
										<WifiOff class="h-4 w-4 text-destructive" />
									{/if}
								</Tooltip.Trigger>
								<Tooltip.Content>{wsReconnect.connected ? 'WebSocket connected' : 'Disconnected'}</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
					<p class="text-sm text-muted-foreground">Expires: {new Date(room.expires_at).toLocaleString()}</p>
				</div>

				<div class="flex items-center gap-2">
					<Tooltip.Provider>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button variant="outline" size="sm" onclick={copyShareLink}>
									{#if copiedShareLink}<Check class="mr-1 h-4 w-4 text-green-500" />Copied!{:else}<Link class="mr-1 h-4 w-4" />Share Link{/if}
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content>{shareUrl}</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>

					<Button variant="outline" size="sm" onclick={leaveRoom}><ArrowLeft class="mr-1 h-4 w-4" />Leave</Button>
				</div>
			</div>

			<Separator />

			<!-- Available Files -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center justify-between text-base">
						<span class="flex items-center gap-2"><Users class="h-4 w-4" />Available Files</span>
						<Badge variant="outline">{roomFiles.length + remoteUploads.length}</Badge>
					</CardTitle>
					<CardDescription>Files are streamed to you automatically. Once received, they are saved to your browser memory for instant access.</CardDescription>
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
											<span class="min-w-0 flex-1 truncate text-sm">{get_display_filename(u.filename)}</span>
											<span class="shrink-0 text-xs text-muted-foreground">{formatFileSize(u.uploadedBytes)} / {formatFileSize(u.size)}</span>
											<LoaderCircle class="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
										</div>
										<Progress value={u.progress.current} max={100} class="h-1" />
									</div>
								{/each}

								{#each roomFiles as f}
									{@const downloaded = downloadedFiles.find((d) => d.key === (f as any).key)}
									{@const isThisStreaming = receiveState.type === 'streaming' && receiveState.key === (f as any).key}
									{@const isThisProcessing = receiveState.type === 'processing' && receiveState.key === (f as any).key}
									{@const isAnyActive = isAnyStreaming || isAnyProcessing}
									{@const displayName = get_display_filename(f.filename)}
									<div class="rounded-md border px-3 py-2">
										<div class="flex items-center gap-3">
											<FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-2">
													<p class="truncate text-sm font-medium">{displayName}</p>
													{#if downloaded}
														<Badge variant="outline" class="h-4 border-green-200 bg-green-50 px-1 text-[10px] text-green-600 uppercase">Saved</Badge>
													{/if}
												</div>
												<p class="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
											</div>

											{#if isThisStreaming || isThisProcessing}
												<div class="flex items-center gap-2 text-xs text-muted-foreground">
													{#if isDecrypting || isThisProcessing}
														<span class="animate-pulse">Decrypting…</span><span class="font-mono">{decryptionProgress.current.toFixed(0)}%</span>
													{:else}
														<span class="animate-pulse">Receiving…</span><span class="font-mono">{streamProgress.toFixed(0)}%</span>
													{/if}
												</div>
											{/if}

											<div class="flex items-center gap-1">
												<Button size="sm" variant="ghost" class="h-7 shrink-0 px-2" onclick={() => copyDownloadLink((f as any).key)}>
													{#if copiedFileKeys.has((f as any).key)}<Check class="h-3.5 w-3.5 text-green-500" />{:else}<Copy class="h-3.5 w-3.5" />{/if}
												</Button>
												{#if downloaded}
													<Button size="sm" variant="default" class="h-7 shrink-0 gap-1 px-2 text-xs" onclick={() => downloadFile(f)} disabled={isAnyActive && currentTransferKey !== (f as any).key}>
														<Download class="h-3.5 w-3.5" />Save
													</Button>
												{:else}
													<Button size="sm" variant="outline" class="h-7 shrink-0 gap-1 px-2 text-xs" onclick={() => downloadFile(f)} disabled={isAnyActive && currentTransferKey !== (f as any).key}>
														<Download class="h-3.5 w-3.5" />Download
													</Button>
												{/if}

												<a href={downloadPageHref((f as any).key)} class="inline-flex h-7 shrink-0 items-center gap-1 px-2 text-xs">
													<Link class="h-3.5 w-3.5" /><span>Download Page</span>
												</a>
											</div>
										</div>
										{#if isThisStreaming || isThisProcessing}
											{#if isDecrypting || isThisProcessing}
												<Progress value={decryptionProgress.current} max={100} class="mt-2 h-1" />
											{:else}
												<Progress value={streamProgress} max={100} class="mt-2 h-1" />
											{/if}
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
