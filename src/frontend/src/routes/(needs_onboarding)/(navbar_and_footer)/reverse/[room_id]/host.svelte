<script lang="ts">
  import { goto } from '$app/navigation';
  import { formatFileSize } from '#functions/bytes';
  import { formatDate } from '#functions/dates';
  import { autoDownload } from '$lib/functions/browser-download';
  import { Api } from '#consts/backend';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { LoaderCircle, Copy, Check } from '@lucide/svelte';
  import { useWsReconnect } from './ws-reconnect.svelte';
  import { getDisplayFilename } from './functions';
  import type { RoomFileEntry } from './types';

  const { room_id } = $props();
  let encryptionKey = $state<string | null>(null);
  let loadStatus = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  let roomFiles = $state<RoomFileEntry[]>([]);
  let hostCount = $state(0);
  let connectedHosts = $state(0);
  let connectedGuests = $state(0);
  let downloadedFiles = $state<Array<{ key: string; objectUrl: string }>>([]);
  let copiedFileKeys = $state(new Set<string>());

  const loadRoom = async () => {
    if (!encryptionKey) return;
    loadStatus = 'loading';
    try {
      const res = await fetch(Api.REVERSE.ROOM_DETAIL(room_id), { headers: { 'X-Encryption-Key': encryptionKey } });
      if (!res.ok) throw new Error('Failed to load room');
      const data = await res.json();
      roomFiles = data.files ?? []; hostCount = data.host_count ?? 0; connectedHosts = data.connected_hosts ?? 0; connectedGuests = data.connected_guests ?? 0;
      loadStatus = 'loaded';
    } catch { loadStatus = 'error'; }
  };

  let ws = useWsReconnect({
    get_room_id: () => room_id, get_host_token: () => undefined, get_receive_state: () => ({ type: 'idle' }),
    get_downloaded_files: () => downloadedFiles, get_room_key: () => encryptionKey,
    onSnapshot: (r: Record<string, unknown>) => { roomFiles = (r.files as RoomFileEntry[]) ?? []; hostCount = typeof r.host_count === 'number' ? r.host_count : 0; },
    onHostCount: (c: number) => { hostCount = c; },
    onConnectionCounts: (h: number, g: number) => { connectedHosts = h; connectedGuests = g; },
    onRoomDestroyed: () => { ws.close(); toast.info('Room destroyed'); goto(`../../${room_id}`); },
  });

  $effect(() => { if (encryptionKey) { loadRoom(); return () => ws.close(); } });

  function submitKey(key: string) { encryptionKey = key; }

  async function downloadFile(file: RoomFileEntry) {
    if (!encryptionKey) return;
    const res = await fetch(`/api/reverse/${room_id}/download/${file.key}`, { headers: { 'X-Encryption-Key': encryptionKey } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    downloadedFiles = [...downloadedFiles, { key: file.key, objectUrl: url }];
    autoDownload(url, getDisplayFilename(file.filename));
  }

  function leaveRoom() { ws.close(); goto(`../../${room_id}`); }
  function copyKey(key: string) { navigator.clipboard.writeText(key); copiedFileKeys = new Set([...copiedFileKeys, key]); setTimeout(() => { copiedFileKeys = new Set([...copiedFileKeys].filter((k) => k !== key)); }, 2000); }
  function isDownloaded(key: string) { return downloadedFiles.some((d) => d.key === key); }
</script>

{#if !encryptionKey}
  <div class="flex h-full w-full items-center justify-center">
    <div class="flex flex-col items-center gap-4 max-w-md w-full p-6">
      <h2 class="text-2xl font-bold">Enter Encryption Key</h2>
      <form onsubmit={(e) => { e.preventDefault(); submitKey((e.target as HTMLFormElement).key.value); }}>
        <input name="key" type="password" placeholder="Encryption key" class="w-full px-3 py-2 border rounded-md" />
      </form>
    </div>
  </div>
{:else if loadStatus === 'loading'}
  <div class="flex h-full w-full items-center justify-center"><LoaderCircle class="size-10 animate-spin text-muted-foreground" /></div>
{:else if loadStatus === 'error'}
  <div class="flex h-full w-full items-center justify-center"><p class="text-lg text-muted-foreground">Failed to load room</p></div>
{:else}
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between rounded-lg border p-4">
      <div><h2 class="text-lg font-semibold">Room: {room_id}</h2><p class="text-sm text-muted-foreground">Hosts: {connectedHosts} / {hostCount} · Guests: {connectedGuests}</p></div>
      <div class="flex items-center gap-2">{#if ws.connected}<span class="text-green-500 text-sm">Connected</span>{:else}<span class="text-red-500 text-sm">Disconnected</span>{/if}</div>
    </div>
    {#each roomFiles as file (file.key)}
      <div class="flex items-center justify-between rounded-lg border p-4">
        <div class="flex flex-col gap-1"><span class="font-medium">{getDisplayFilename(file.filename)}</span><span class="text-sm text-muted-foreground">{formatFileSize(file.size)} · Added {formatDate(file.uploaded_at)}</span></div>
        <div class="flex items-center gap-2">
          {#if isDownloaded(file.key)}
            {#each downloadedFiles as downloaded}
              {#if downloaded.key === file.key}<a href={downloaded.objectUrl} download={getDisplayFilename(file.filename)} class="text-sm text-primary hover:underline">Download</a>{/if}
            {/each}
          {:else}<Button variant="secondary" size="sm" class="cursor-pointer" onclick={() => downloadFile(file)}>Request Download</Button>{/if}
          <Button variant="ghost" size="icon" class="cursor-pointer" onclick={() => copyKey(file.key)}>
            {#if copiedFileKeys.has(file.key)}<Check class="size-4 text-green-500" />{:else}<Copy class="size-4" />{/if}
          </Button>
        </div>
      </div>
    {/each}
    <div class="flex justify-end"><Button variant="destructive" class="cursor-pointer" onclick={leaveRoom}>Leave Room</Button></div>
  </div>
{/if}
