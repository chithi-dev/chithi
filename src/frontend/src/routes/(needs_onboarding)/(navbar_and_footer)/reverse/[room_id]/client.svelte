<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Field from '$lib/components/ui/field/index.js';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { Download, Copy, Check, Link, Users, FileIcon, ArrowLeft, Wifi, WifiOff, Zap, MousePointerClick } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { formatFileSize } from '#functions/bytes';
  import { formatDate } from '#functions/dates';
  import { autoDownload } from '$lib/functions/browser-download';
  import { Api } from '#consts/backend';
  import { createDecryptedStream } from '#functions/streams';
  import { resolve } from '$app/paths';
  import { extractEncryptionKey } from './utils';
  import { getDisplayFilename } from './functions';
  import { useWsReconnect } from './ws-reconnect.svelte';
  import type { DownloadedFile, ReceiveState, RemoteUpload, RoomFileEntry, RoomOut } from './types';

  const { room_id }: { room_id: string } = $props();
  let roomKey = $derived(extractEncryptionKey(page.url.hash.slice(1)));
  const downloadHref = (key: string) => resolve(`/download/${key}${roomKey ? `#${roomKey}` : ''}`);
  let loadStatus = $state<'loading' | 'not_found' | 'error' | 'loaded'>('loading');
  let room = $state<RoomOut | null>(null);
  let roomFiles = $state<RoomFileEntry[]>([]);
  let hostCount = $state(1);
  let receiveState = $state<ReceiveState>({ type: 'idle' });
  let downloadedFiles = $state<DownloadedFile[]>([]);
  let decryptionProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
  let isDecrypting = $state(false);
  let downloadPreference = $state<'eager' | 'manual' | null>(null);

  $effect(() => {
    if (downloadPreference === 'eager' && receiveState.type === 'idle') {
      const next = roomFiles.find((f) => !downloadedFiles.some((d) => d.key === f.key));
      if (next) downloadFile(next);
    }
  });

  let remoteUploads = $state<RemoteUpload[]>([]);
  const { connected: wsConnected, send: wsSend, close: wsClose } = useWsReconnect({
    get_room_id: () => room_id,
    get_host_token: () => undefined,
    get_receive_state: () => receiveState,
    get_downloaded_files: () => downloadedFiles,
    get_room_key: () => roomKey,

    onSnapshot: (r) => {
      const ro = r as unknown as RoomOut;
      room = ro;
      roomFiles = structuredClone(ro.files);
      hostCount = ro.host_count ?? 1;
      remoteUploads = ro.active_uploads?.map((u) => ({
        key: u.upload_key,
        filename: u.filename,
        size: u.size,
        uploadedBytes: u.uploaded_bytes,
        progress: new Tween(
          u.size > 0 ? Math.min((u.uploaded_bytes / u.size) * 100, 100) : 0,
          { duration: 300, easing: cubicOut }
        )
      })) ?? [];
    },

    onHostCount: (c: number) => {
      hostCount = c;
    },

    onUploadStart: (entry) => {
      if (!remoteUploads.some((u) => u.key === entry.key)) {
        remoteUploads = [...remoteUploads, { ...entry, uploadedBytes: 0, progress: new Tween(0, { duration: 300, easing: cubicOut }) }];
      }
    },

    onUploadProgress: (k: string, b: number) => {
      const upload = remoteUploads.find((u) => u.key === k);
      if (upload) {
        upload.uploadedBytes = b;
        upload.progress.target = Math.min((b / upload.size) * 100, 100);
      }
    },

    onUploadCancelled: (k: string) => {
      remoteUploads = remoteUploads.filter((u) => u.key !== k);
    },

    onFileStart: (k: string, fn: string, sz: number) => {
      if (downloadPreference === 'eager' && receiveState.type === 'idle') {
        receiveState = { type: 'streaming', key: k, filename: fn, size: sz, received: 0, chunks: [] };
      } else if (receiveState.type === 'streaming' && receiveState.key === k) {
        receiveState.filename = fn;
      }
    },

    onFileEnd: async (k: string, fn: string, sz: number) => {
      if (receiveState.type === 'streaming' && receiveState.key === k) {
        const { key: rk, filename: rf, size: rs, chunks } = receiveState;
        receiveState = { type: 'processing', key: rk, filename: rf, size: rs };
        try {
          let blob = new Blob(chunks as BlobPart[]);
          if (roomKey) {
            isDecrypting = true;
            decryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
            const decryptedStream = await createDecryptedStream(
              blob.stream() as any,
              roomKey,
              undefined,
              blob.size,
              (processed, total) => {
                if (total && total > 0) {
                  decryptionProgress.target = Math.min(100, Math.round((processed / total) * 100));
                }
              }
            );
            blob = await new Response(decryptedStream as any).blob();
            isDecrypting = false;
            decryptionProgress.target = 100;
          }
          const url = URL.createObjectURL(blob);
          downloadedFiles = [...downloadedFiles, { key: rk, filename: rf, size: rs, objectUrl: url }];
          toast.success(`Received: ${rf}`);
          autoDownload(url, rf);
        } catch {
          toast.error(`Decryption failed for ${rf}`);
          receiveState = { type: 'idle' };
        }
      }
    },

    onFileError: (detail: string, k: string) => {
      if (receiveState.type === 'streaming' && receiveState.key === k) {
        receiveState = { type: 'idle' };
      }
      toast.error(`File error: ${detail}`);
    },

    onRoomDestroyed: () => {
      cleanup();
      toast.info('The host has closed the room.');
      goto('/reverse');
    },

    onFileRemoved: (k: string) => {
      roomFiles = roomFiles.filter((f) => f.key !== k);
    },

    onConnectionCounts: (h: number, g: number) => {
      if (room) {
        room.connected_hosts = h;
        room.connected_guests = g;
      }
    },
  });

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
  const isStreaming = $derived(receiveState.type === 'streaming');
  const isProcessing = $derived(receiveState.type === 'processing');
  const transferKey = $derived((isStreaming || isProcessing) ? (receiveState as any).key : null);

  function submitKey() {
    const k = keyInput.trim();
    if (!k) {
      toast.error('Please enter an encryption key');
      return;
    }
    window.location.hash = k;
    showKeyPrompt = false;
    toast.success('Encryption key set');
    loadRoom();
  }

  async function loadRoom() {
    loadStatus = 'loading';
    try {
      const res = await fetch(Api.REVERSE.ROOM_DETAIL(room_id), { credentials: 'include' });
      if (res.status === 404) {
        loadStatus = 'not_found';
        return;
      }
      if (!res.ok) throw new Error();
      const data: RoomOut = await res.json();
      room = data;
      roomFiles = structuredClone(data.files);
      hostCount = data.host_count ?? 1;
      loadStatus = 'loaded';
      if (!roomKey) showKeyPrompt = true;
    } catch {
      loadStatus = 'error';
    }
  }

  async function copyShareLink() {
    const url = roomKey ? `${shareUrl}#${roomKey}` : shareUrl;
    await navigator.clipboard.writeText(url);
    copiedShareLink = true;
    setTimeout(() => copiedShareLink = false, 2000);
  }

  async function copyDownloadLink(k: string) {
    await navigator.clipboard.writeText(downloadHref(k));
    copiedFileKeys = new Set([...copiedFileKeys, k]);
    setTimeout(() => {
      copiedFileKeys.delete(k);
      copiedFileKeys = new Set(copiedFileKeys);
    }, 2000);
  }

  function leaveRoom() {
    cleanup();
    goto('/reverse');
  }

  async function downloadFile(f: RoomFileEntry) {
    const dl = downloadedFiles.find((d) => d.key === f.key);
    if (dl?.objectUrl) {
      autoDownload(dl.objectUrl, f.filename);
      return;
    }
    if (receiveState.type !== 'idle') {
      toast.error('Another file is currently being received.');
      return;
    }
    receiveState = { type: 'streaming', key: f.key, filename: f.filename, size: f.size, received: 0, chunks: [] };
    if (wsConnected) wsSend({ type: 'request_file', key: f.key });
    else {
      toast.error('WebSocket not connected. Cannot request file.');
      receiveState = { type: 'idle' };
    }
  }

  function cleanup() {
    downloadedFiles.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl));
  }

  $effect(() => {
    if (roomKey) loadRoom();
    else showKeyPrompt = true;
    return () => { wsClose(); cleanup(); };
  });
</script>

{#if showKeyPrompt}
  <div class="flex min-h-[70vh] items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <Card.Root>
        <Card.Header><Card.Title class="flex items-center gap-2"><Download class="h-5 w-5" />Enter Room Key</Card.Title></Card.Header>
        <Card.Content class="space-y-4">
          <Field.Field>
            <Field.Label>Room Key</Field.Label>
            <Field.Content>
              <Input type="password" placeholder="Paste room key here" bind:value={keyInput} onkeydown={(e) => e.key === 'Enter' && submitKey()} />
            </Field.Content>
          </Field.Field>
          <p class="text-sm text-muted-foreground">This key is required to decrypt files sent to this room.</p>
        </Card.Content>
        <Card.Footer class="flex gap-2">
          <Button variant="outline" onclick={() => goto('/reverse')}><ArrowLeft class="mr-1 h-4 w-4" />Back</Button>
          <Button onclick={submitKey} class="flex-1">Enter Key</Button>
        </Card.Footer>
      </Card.Root>
    </div>
  </div>
{:else if loadStatus === 'loading'}
  <div class="flex min-h-[70vh] items-center justify-center">
    <div class="flex items-center gap-3 text-muted-foreground">
      <Spinner class="size-6" />
      <span>Loading room…</span>
    </div>
  </div>
{:else if loadStatus === 'not_found'}
  <div class="flex min-h-[70vh] items-center justify-center p-4">
    <div class="space-y-4 text-center">
      <h2 class="text-2xl font-bold">Room Not Found</h2>
      <p class="text-muted-foreground">This room doesn't exist or has expired.</p>
      <Button onclick={() => goto('/reverse')}><ArrowLeft class="mr-2 h-4 w-4" />Back to Reverse Share</Button>
    </div>
  </div>
{:else if loadStatus === 'error'}
  <div class="flex min-h-[70vh] items-center justify-center p-4">
    <div class="space-y-4 text-center">
      <h2 class="text-2xl font-bold">Something went wrong</h2>
      <p class="text-muted-foreground">Failed to load the room. Please try again.</p>
      <div class="flex justify-center gap-2">
        <Button variant="outline" onclick={() => goto('/reverse')}><ArrowLeft class="mr-2 h-4 w-4" />Go Back</Button>
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
        <Card.Root class="relative cursor-pointer border-2 border-primary bg-primary/5 transition-all hover:border-primary/50 hover:shadow-lg" onclick={() => downloadPreference = 'eager'}>
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge class="bg-primary px-3 py-1 text-primary-foreground shadow-md">Recommended</Badge>
          </div>
          <Card.Header class="flex flex-col items-center pt-8 pb-2 text-center">
            <div class="mb-3 rounded-full bg-primary/20 p-4"><Zap class="h-8 w-8 text-primary" /></div>
            <Card.Title class="text-xl">Eager Download</Card.Title>
          </Card.Header>
          <Card.Content class="text-center text-muted-foreground">Files are automatically downloaded as soon as they are shared. Perfect for real-time collaboration.</Card.Content>
          <Card.Footer class="justify-center pb-6"><Button class="w-full">Select Eager</Button></Card.Footer>
        </Card.Root>
        <Card.Root class="cursor-pointer border-2 border-transparent transition-all hover:border-primary/50 hover:shadow-lg" onclick={() => downloadPreference = 'manual'}>
          <Card.Header class="flex flex-col items-center pt-8 pb-2 text-center">
            <div class="mb-3 rounded-full bg-muted p-4"><MousePointerClick class="h-8 w-8 text-muted-foreground" /></div>
            <Card.Title class="text-xl">Manual Download</Card.Title>
          </Card.Header>
          <Card.Content class="text-center text-muted-foreground">Review shared files first and choose which ones to download. Best for limited bandwidth.</Card.Content>
          <Card.Footer class="justify-center pb-6"><Button variant="outline" class="w-full">Select Manual</Button></Card.Footer>
        </Card.Root>
      </div>
    </div>
  {:else}
    <div class="mx-auto max-w-3xl space-y-6 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold">{room.name}</h1>
            <Badge variant="secondary">Guest</Badge>
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger><Badge variant="outline" class="gap-1"><Users class="h-3 w-3" />{room.connected_hosts} {room.connected_hosts === 1 ? 'host' : 'hosts'}</Badge></Tooltip.Trigger>
                <Tooltip.Content>{room.connected_hosts} host{room.connected_hosts === 1 ? '' : 's'} online</Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#if wsConnected}<Wifi class="h-4 w-4 text-muted-foreground" />{:else}<WifiOff class="h-4 w-4 text-destructive" />{/if}
                </Tooltip.Trigger>
                <Tooltip.Content>{wsConnected ? 'WebSocket connected' : 'Disconnected'}</Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
          <p class="text-sm text-muted-foreground">Expires: {formatDate(room.expires_at)}</p>
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
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center justify-between text-base">
            <span class="flex items-center gap-2"><Users class="h-4 w-4" />Available Files</span>
            <Badge variant="outline">{roomFiles.length + remoteUploads.length}</Badge>
          </Card.Title>
          <Card.Description>Files are streamed to you automatically. Once received, they are saved to your browser memory for instant access.</Card.Description>
        </Card.Header>
        <Card.Content>
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
                      <span class="min-w-0 flex-1 truncate text-sm">{getDisplayFilename(u.filename)}</span>
                      <span class="shrink-0 text-xs text-muted-foreground">{formatFileSize(u.uploadedBytes)} / {formatFileSize(u.size)}</span>
                      <Spinner class="size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <Progress value={u.progress.current} max={100} class="h-1" />
                  </div>
                {/each}
                {#each roomFiles as f}
                  {@const dl = downloadedFiles.find((d) => d.key === f.key)}
                  {@const streaming = receiveState.type === 'streaming' && receiveState.key === f.key}
                  {@const processing = receiveState.type === 'processing' && receiveState.key === f.key}
                  {@const active = isStreaming || isProcessing}
                  <div class="rounded-md border px-3 py-2">
                    <div class="flex items-center gap-3">
                      <FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <p class="truncate text-sm font-medium">{getDisplayFilename(f.filename)}</p>
                          {#if dl}<Badge variant="outline" class="h-4 border-green-200 bg-green-50 px-1 text-[10px] text-green-600 uppercase">Saved</Badge>{/if}
                        </div>
                        <p class="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                      </div>
                      {#if streaming || processing}
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                          {#if isDecrypting || processing}
                            <span class="animate-pulse">Decrypting…</span>
                            <span class="font-mono">{decryptionProgress.current.toFixed(0)}%</span>
                          {:else}
                            <span class="animate-pulse">Receiving…</span>
                            <span class="font-mono">{streamProgress.toFixed(0)}%</span>
                          {/if}
                        </div>
                      {/if}
                      <div class="flex items-center gap-1">
                        <Button size="sm" variant="ghost" class="h-7 shrink-0 px-2" onclick={() => copyDownloadLink(f.key)}>
                          {#if copiedFileKeys.has(f.key)}<Check class="h-3.5 w-3.5 text-green-500" />{:else}<Copy class="h-3.5 w-3.5" />{/if}
                        </Button>
                        {#if dl}
                          <Button size="sm" variant="default" class="h-7 shrink-0 gap-1 px-2 text-xs" onclick={() => downloadFile(f)} disabled={active && transferKey !== f.key}>
                            <Download class="h-3.5 w-3.5" />Save
                          </Button>
                        {:else}
                          <Button size="sm" variant="outline" class="h-7 shrink-0 gap-1 px-2 text-xs" onclick={() => downloadFile(f)} disabled={active && transferKey !== f.key}>
                            <Download class="h-3.5 w-3.5" />Download
                          </Button>
                        {/if}
                        <a href={downloadHref(f.key)} class="inline-flex h-7 shrink-0 items-center gap-1 px-2 text-xs">
                          <Link class="h-3.5 w-3.5" /><span>Download Page</span>
                        </a>
                      </div>
                    </div>
                    {#if streaming || processing}
                      {#if isDecrypting || processing}<Progress value={decryptionProgress.current} max={100} class="mt-2 h-1" />
                      {:else}<Progress value={streamProgress} max={100} class="mt-2 h-1" />{/if}
                    {/if}
                  </div>
                {/each}
              </div>
            </ScrollArea>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
{/if}
