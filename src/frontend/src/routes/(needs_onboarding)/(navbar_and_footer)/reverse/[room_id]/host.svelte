<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Field from '$lib/components/ui/field/index.js';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import {
    Upload, Download, Copy, Check, Link, Plus, X, Users,
    FileIcon, ArrowLeft, Wifi, WifiOff, UserPlus
  } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { formatFileSize } from '#functions/bytes';
  import { formatDate } from '#functions/dates';
  import { autoDownload } from '$lib/functions/browser-download';
  import { Api } from '#consts/backend';
  import { createZipStream, createEncryptedStream, createDecryptedStream } from '#functions/streams';
  import { base64urlToBytes } from '#functions/encryption';
  import { resolve } from '$app/paths';
  import { extractEncryptionKey, extractHostToken } from './utils';
  import { getDisplayFilename } from './functions';
  import { useWsReconnect } from './ws-reconnect.svelte';
  import type { DownloadedFile, ReceiveState, RemoteUpload, RoomFileEntry, RoomOut, UploadEntry } from './types';

  const { room_id }: { room_id: string } = $props();
  let hostToken = $derived(extractHostToken(page.url.hash.slice(1)));
  let roomKey = $derived(extractEncryptionKey(page.url.hash.slice(1)));

  const downloadPageHref = (fileKey: string) =>
    resolve(`/download/${fileKey}${roomKey ? `#${roomKey}` : ''}`);

  let loadStatus = $state<'loading' | 'not_found' | 'error' | 'loaded'>('loading');
  let room = $state<RoomOut | null>(null);
  let roomFiles = $state<RoomFileEntry[]>([]);
  let hostCount = $state(1);

  // Host key prompt
  let showKeyPrompt = $state(false);
  let keyInput = $state('');

  // Host upload
  let pendingFiles = $state<File[]>([]);
  let fileInput = $state<HTMLInputElement>();
  let uploads = $state<UploadEntry[]>([]);
  let isUploading = $state(false);
  const overallProgress = new Tween(0, { duration: 400, easing: cubicOut });
  let encryptionProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
  let isEncrypting = $state(false);

  // Client streaming (download)
  let receiveState = $state<ReceiveState>({ type: 'idle' });
  let downloadedFiles = $state<DownloadedFile[]>([]);
  let decryptionProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
  let isDecrypting = $state(false);

  // Remote uploads from other hosts
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
    } catch { loadStatus = 'error'; }
  }

  let ws = useWsReconnect({
    get_room_id: () => room_id,
    get_host_token: () => hostToken || undefined,
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
    onHostCount: (c: number) => { hostCount = c; },
    onConnectionCounts: (h: number, g: number) => {
      if (room) { room.connected_hosts = h; room.connected_guests = g; }
    },
    onUploadStart: (entry) => {
      if (!remoteUploads.some((u) => u.key === entry.key)) {
        remoteUploads = [...remoteUploads, { ...entry, uploadedBytes: 0 }];
      }
    },
    onUploadProgress: (k: string, b: number) => {
      const u = remoteUploads.find((u) => u.key === k);
      if (u) { u.uploadedBytes = b; }
    },
    onUploadCancelled: (k: string) => {
      remoteUploads = remoteUploads.filter((u) => u.key !== k);
    },
    onFileStart: (k: string, fn: string, sz: number) => {
      if (receiveState.type === 'idle') {
        if (downloadedFiles.some((d) => d.key === k)) return;
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
          let blob: Blob = new Blob(chunks as unknown as BlobPart[]);
          if (roomKey) {
            isDecrypting = true;
            decryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
            const { stream } = await createDecryptedStream(
              blob.stream() as any,
              roomKey,
              undefined,
              blob.size,
              (p, t) => { if (t && t > 0) decryptionProgress.target = Math.min(100, Math.round((p / t) * 100)); }
            );
            blob = await new Response(stream as any).blob();
            isDecrypting = false;
            decryptionProgress.target = 100;
          }
          const url = URL.createObjectURL(blob);
          downloadedFiles = [...downloadedFiles, { key: rk, filename: rf, size: rs, objectUrl: url }];
          toast.success(`Received: ${rf}`);
          autoDownload(url, rf);
        } catch {
          toast.error(`Decryption failed for ${rf}`);
        } finally {
          receiveState = { type: 'idle' };
          isDecrypting = false;
        }
      }
    },
    onFileError: (detail: string, k: string) => {
      if (receiveState.type === 'streaming' && receiveState.key === k) receiveState = { type: 'idle' };
      toast.error(`File error: ${detail}`);
    },
    onFileRemoved: (k: string) => {
      roomFiles = roomFiles.filter((f) => f.key !== k);
      downloadedFiles = downloadedFiles.filter((f) => f.key !== k);
    },
    onRoomDestroyed: () => {
      ws.close();
      toast.info('The room has been destroyed.');
      goto('/reverse');
    },
  });

  $effect(() => {
    if (roomKey) loadRoom();
    else showKeyPrompt = true;
    return () => { ws.close(); cleanup(); };
  });

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
        isEncrypting = true;
        encryptionProgress.set(0, { duration: 0 });

        const zipStream = await createZipStream([entry.file]);
        const { stream: encryptedStream } = await createEncryptedStream(
          zipStream,
          undefined,
          entry.file.size,
          (processed, total) => {
            if (total && total > 0) {
              encryptionProgress.target = Math.min(100, (processed / total) * 100);
            }
          },
          ikm
        );

        const encryptedBlob = await new Response(encryptedStream).blob();
        encryptionProgress.target = 100;

        // Allow time for the progress bar to animate to 100%
        await new Promise((r) => setTimeout(r, 600));
        isEncrypting = false;

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

        // Add to downloadedFiles so it shows as "Saved" instead of "Download"
        const objectUrl = URL.createObjectURL(entry.file);
        downloadedFiles = [
          ...downloadedFiles,
          { key: fileEntry.key, filename: entry.file.name, size: entry.file.size, objectUrl }
        ];
      } catch (e: any) {
        entry.status = 'error';
        toast.error(`Upload failed for ${entry.file.name}: ${e.message || String(e)}`);
      } finally {
        isEncrypting = false;
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
      xhr.open('POST', Api.REVERSE.ROOM_UPLOAD(room_id));
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
    setTimeout(() => copiedShareLink = false, 2000);
  }

  async function inviteHost() {
    isInviting = true;
    try {
      const res = await fetch(Api.REVERSE.ROOM_HOSTS(room_id), {
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
      setTimeout(() => copiedInviteLink = false, 3000);
    } catch (e: any) {
      toast.error(`Failed to create invite: ${e.message || String(e)}`);
    } finally {
      isInviting = false;
    }
  }

  async function copyDownloadLink(key: string) {
    const url = downloadPageHref(key);
    await navigator.clipboard.writeText(url);
    copiedFileKeys = new Set([...copiedFileKeys, key]);
    setTimeout(() => {
      copiedFileKeys.delete(key);
      copiedFileKeys = new Set(copiedFileKeys);
    }, 2000);
  }

  function leaveRoom() {
    ws.close();
    cleanup();
    goto('/reverse');
  }

  async function downloadFile(f: RoomFileEntry) {
    const downloaded = downloadedFiles.find((d) => d.key === f.key);
    if (downloaded?.objectUrl) {
      autoDownload(downloaded.objectUrl, f.filename);
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

    if (ws.connected) ws.send({ type: 'request_file', key: f.key });
    else {
      toast.error('WebSocket not connected. Cannot request file.');
      receiveState = { type: 'idle' };
    }
  }

  function cleanup() {
    downloadedFiles.forEach((f) => f.objectUrl && URL.revokeObjectURL(f.objectUrl));
  }
</script>

{#if showKeyPrompt}
  <div class="flex min-h-[70vh] items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <Card.Root>
        <Card.Header><Card.Title class="flex items-center gap-2"><Upload class="h-5 w-5" />Enter Room Key</Card.Title></Card.Header>
        <Card.Content class="space-y-4">
          <Field.Field>
            <Field.Label>Room Key</Field.Label>
            <Field.Content>
              <Input type="password" placeholder="Paste room key here" bind:value={keyInput} onkeydown={(e) => e.key === 'Enter' && submitKey()} />
            </Field.Content>
          </Field.Field>
          <p class="text-sm text-muted-foreground">This key is required to encrypt and decrypt files in this room.</p>
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
    <div class="flex items-center gap-3 text-muted-foreground"><Spinner class="size-6" /><span>Loading room…</span></div>
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
                {#if ws.connected}
                  <Wifi class="h-4 w-4 text-muted-foreground" />
                {:else}
                  <WifiOff class="h-4 w-4 text-destructive" />
                {/if}
              </Tooltip.Trigger>
              <Tooltip.Content>
                {ws.connected ? 'WebSocket connected' : 'Disconnected'}
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        <p class="text-sm text-muted-foreground">
          Expires: {formatDate(room.expires_at)}
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
                  <Spinner class="mr-1" />
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
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2 text-base">
          <Upload class="h-4 w-4" />
          Upload Files
        </Card.Title>
        <Card.Description>
          Files you upload are pushed to all connected clients via WebSocket.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
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
                  <span class="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onclick={() => removePendingFile(i)}
                    aria-label="Remove"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
              {/each}
            </div>
          </ScrollArea>
        {/if}

        {#if isUploading || (uploads.length > 0 && completedUploads < totalUploads)}
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Overall — {completedUploads}/{totalUploads} files</span>
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
                  <span class="shrink-0 text-xs text-muted-foreground">{formatFileSize(u.file.size)}</span>
                  {#if u.status === 'done'}
                    <Check class="h-4 w-4 shrink-0 text-green-500" />
                  {:else if u.status === 'error'}
                    <X class="h-4 w-4 shrink-0 text-destructive" />
                  {:else if u.status === 'uploading'}
                    {#if isEncrypting}
                      <span class="animate-pulse text-xs text-muted-foreground">Encrypting…</span>
                    {:else}
                      <Spinner class="size-4 shrink-0 text-muted-foreground" />
                    {/if}
                  {/if}
                </div>
                {#if u.status === 'uploading' || u.status === 'pending'}
                  {#if u.status === 'uploading' && isEncrypting}
                    <Progress value={encryptionProgress.current} max={100} class="h-1" />
                  {:else}
                    <Progress value={u.progress.current} max={100} class="h-1" />
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </Card.Content>
      <Card.Footer>
        <Button
          onclick={uploadAll}
          disabled={pendingFiles.length === 0 || isUploading}
          class="w-full"
        >
          {#if isUploading}
            <Spinner />
            Uploading…
          {:else}
            <Upload class="mr-2 h-4 w-4" />
            Upload {pendingFiles.length > 0
              ? `${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`
              : 'Files'}
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Shared Files List -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center justify-between text-base">
          <span class="flex items-center gap-2">
            <Users class="h-4 w-4" />
            Shared Files
          </span>
          <Badge variant="outline">{roomFiles.length + remoteUploads.length}</Badge>
        </Card.Title>
      </Card.Header>
      <Card.Content>
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
                    <span class="min-w-0 flex-1 truncate text-sm">{getDisplayFilename(u.filename)}</span>
                    <span class="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(u.uploadedBytes)} / {formatFileSize(u.size)}
                    </span>
                    <Spinner class="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <Progress value={u.progress.current} max={100} class="h-1" />
                </div>
              {/each}

              {#each roomFiles as f}
                {@const downloaded = downloadedFiles.find((d) => d.key === f.key)}
                {@const isThisStreaming = receiveState.type === 'streaming' && receiveState.key === f.key}
                {@const isThisProcessing = receiveState.type === 'processing' && receiveState.key === f.key}
                {@const isAnyActive = isAnyStreaming || isAnyProcessing}
                {@const displayName = getDisplayFilename(f.filename)}
                <div class="rounded-md border px-3 py-2">
                  <div class="flex items-center gap-3">
                    <FileIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <p class="truncate text-sm font-medium">{displayName}</p>
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

                    {#if isThisStreaming || isThisProcessing}
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        {#if isDecrypting || isThisProcessing}
                          <span class="animate-pulse">Decrypting…</span>
                          <span class="font-mono">{decryptionProgress.current.toFixed(0)}%</span>
                        {:else}
                          <span class="animate-pulse">Receiving…</span>
                          <span class="font-mono">{streamProgress.toFixed(0)}%</span>
                        {/if}
                      </div>
                    {/if}

                    <div class="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-7 shrink-0 px-2"
                        onclick={() => copyDownloadLink(f.key)}
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
                          disabled={isAnyActive && currentTransferKey !== f.key}
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
                          disabled={isAnyActive && currentTransferKey !== f.key}
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
      </Card.Content>
    </Card.Root>
  </div>
{/if}
