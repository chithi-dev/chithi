<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as InputGroup from '$lib/components/ui/input-group/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import { FileText, CircleAlert, Download, KeyRound, Eye, File, Folder, ExternalLink, Image as ImageIcon, FileCode, FolderOpen, FilePlay, FileHeadphone } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { fly, fade } from 'svelte/transition';
  import { fetchDecryptedBlob } from '$lib/functions/fetch-decrypt';
  import { PasswordRequiredError } from '#errors/password';
  import { formatFileSize } from '#functions/bytes';
  import { toast } from 'svelte-sonner';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { ZipReader, BlobReader, BlobWriter, type Entry } from '@zip.js/zip.js';
  import { detectMimeFromBlob } from '#functions/mime';
  import { createViewableText } from '$lib/functions/viewer';
  import FileViewerOverlay from '$lib/components/FileViewerOverlay.svelte';
  import { autoDownload } from '$lib/functions/browser-download';
  import { validateZipBlob } from '#functions/zip-validate';
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
  import * as HoverCard from '$lib/components/ui/hover-card/index.js';
  import { useFileInfoQuery } from '#queries/file-info';

  const key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
  const slug = $derived(page.params.slug);
  const fileParam = $derived(page.url.searchParams.get('file'));
  const { fileInfo } = useFileInfoQuery(() => slug ?? '');
  const hasKey = $derived(Boolean(key && slug));
  let phase = $state<'ready' | 'needs_password' | 'downloading' | 'unzipping' | 'listing' | 'error'>('ready');
  const status = $derived(
    hasKey && fileInfo.isPending ? 'checking'
    : hasKey && fileInfo.isError ? 'error'
    : phase
  );
  const errorMsg = $derived(fileInfo.error?.message ?? 'An error occurred');
  const filename = $derived(fileInfo.data?.filename ?? 'file');
  const fileSize = $derived(fileInfo.data?.fileSize ?? 0);
  let password = $state('');
  let prog = $state(new Tween(0, { duration: 500, easing: cubicOut }));
  let zipEntries = $state<Entry[]>([]);
  let decryptedBlob = $state<Blob | null>(null);
  let viewingFile = $state<{ text: string | null; url: string | null; filename: string } | null>(null);

  function fileIcon(n: string) {
    const lower = n.toLowerCase();
    if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|avif|jxl|jxr|hdp|wdp)$/)) return ImageIcon;
    if (lower.match(/\.(mp4|webm|ogv|mov|mkv)$/)) return FilePlay;
    if (lower.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) return FileHeadphone;
    if (lower.match(/\.(txt|md|json|js|ts|svelte|html|css|scss|xml|log|csv|sh|yaml|yml|sql|py|java|c|cpp|h|go|rs|php|rb)$/)) return FileCode;
    return File;
  }

  function setFileParam(name: string | null) {
    const url = new URL(page.url);
    if (name) {
      url.searchParams.set('file', name);
    } else {
      url.searchParams.delete('file');
    }
    goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
  }

  async function fetchAndUnzip() {
    if (!key || !slug) return;
    const prev = phase;
    phase = 'downloading';
    prog = new Tween(0, { duration: 500, easing: cubicOut });
    try {
      const blob = await fetchDecryptedBlob(slug, key, password, { knownSize: fileSize, onProgress: (p) => prog.target = p });
      decryptedBlob = blob;
      await validateZipBlob(blob);
      phase = 'unzipping';
      const reader = new ZipReader(new BlobReader(blob));
      zipEntries = await reader.getEntries();
      phase = 'listing';
      toast.success('Files extracted successfully');
      if (fileParam) {
        const match = zipEntries.find((e) => e.filename === fileParam);
        if (match) openEntry(match);
      }
    } catch (e: any) {
      if (e instanceof PasswordRequiredError) {
        phase = 'needs_password';
        toast.info('Password required for decryption');
      } else if (e.message?.includes('End of central directory') || e.message?.includes('missing end marker') || e.message?.includes('too small')) {
        phase = 'error';
        if (e.message?.includes('missing end marker')) {
          toast.error('The decrypted archive appears truncated or corrupted.');
        } else {
          toast.error('The decrypted data is not a valid archive.');
        }
      } else if (prev === 'needs_password' && password) {
        toast.error('Incorrect password?');
        phase = 'needs_password';
      } else if (e.name === 'AbortError') {
        phase = 'ready';
      } else {
        toast.error('Failed: ' + e.message);
        phase = 'error';
      }
    }
  }

  async function openEntry(entry: Entry) {
    if (entry.directory || !entry.getData) return;
    const rawBlob = await entry.getData(new BlobWriter('application/octet-stream'), { password });
    const detectedMime = await detectMimeFromBlob(rawBlob);
    const viewBlob = detectedMime ? rawBlob.slice(0, rawBlob.size, detectedMime) : rawBlob;
    const text = await createViewableText(viewBlob, detectedMime);
    if (text !== null) {
      viewingFile = { text, url: null, filename: entry.filename };
      setFileParam(entry.filename);
      return;
    }
    const url = URL.createObjectURL(viewBlob);
    viewingFile = { text: null, url, filename: entry.filename };
    setFileParam(entry.filename);
  }

  function closeViewer() {
    if (viewingFile?.url) URL.revokeObjectURL(viewingFile.url);
    viewingFile = null;
    setFileParam(null);
  }

  function copyViewerLink() {
    if (!viewingFile) return;
    const url = new URL(page.url);
    url.searchParams.set('file', viewingFile.filename);
    navigator.clipboard.writeText(url.toString());
  }

  async function saveEntry(entry: Entry) {
    if (entry.directory || !entry.getData) return;
    const blob = await entry.getData(new BlobWriter(), { password });
    const url = URL.createObjectURL(blob);
    autoDownload(url, entry.filename.split('/').pop() || 'file');
    URL.revokeObjectURL(url);
  }

  function downloadOriginal() {
    if (!decryptedBlob) return;
    const name = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;
    const url = URL.createObjectURL(decryptedBlob);
    autoDownload(url, name);
    URL.revokeObjectURL(url);
  }
</script>

<Card.Root class="relative z-10 mx-auto w-full max-w-5xl border-border bg-card">
  <Card.Content class="p-6">
    <div class="flex min-h-150 flex-col items-center justify-center">
      {#if status === 'checking'}
        <div class="flex flex-col items-center justify-center py-8">
          <Spinner class="mb-4 size-8 text-primary" />
          <p class="text-muted-foreground">Verifying key and file...</p>
        </div>
      {/if}
      {#if status === 'error'}
        {#if !key}
          <div in:fly={{ y: 20, duration: 800 }} class="mx-auto w-full max-w-lg">
            <Card.Header class="px-0 text-center">
              <div class="mx-auto my-3 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <KeyRound class="h-10 w-10 text-destructive" />
              </div>
              <Card.Title class="text-2xl font-bold">Decryption Key Required</Card.Title>
              <Card.Description class="mt-2 text-muted-foreground">{errorMsg || 'The decryption key is missing.'}</Card.Description>
            </Card.Header>
            <Card.Footer class="mt-6 flex w-full flex-col gap-6 px-0">
              <Button class="w-full" variant="outline" href="/">Go Home</Button>
            </Card.Footer>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-8 text-destructive">
            <CircleAlert class="mb-4 h-12 w-12" />
            <p class="font-medium">{errorMsg}</p>
            <Button variant="outline" class="mt-4" onclick={() => location.reload()}>Retry</Button>
          </div>
        {/if}
      {/if}
      {#if status === 'ready' || status === 'needs_password' || status === 'downloading' || status === 'unzipping'}
        <div class="w-full max-w-lg">
          <Card.Header class="px-0 text-center">
            <Card.Title class="text-2xl font-bold">View Archive</Card.Title>
            <Card.Description class="text-muted-foreground">Decrypt and view contents of this archive directly in your browser.</Card.Description>
          </Card.Header>
          <Card.Content class="w-full px-0">
            {#if status === 'needs_password'}
              <div class="mx-auto flex w-full max-w-sm flex-col items-center gap-2 py-8">
                <InputGroup.Root class="w-full">
                  <Input type="password" placeholder="Password" bind:value={password} onkeydown={(e) => e.key === 'Enter' && fetchAndUnzip()} />
                  <InputGroup.Button>
                    <Button onclick={fetchAndUnzip}>Unlock</Button>
                  </InputGroup.Button>
                </InputGroup.Root>
                <p class="text-xs text-muted-foreground">Enter password to decrypt the archive.</p>
              </div>
            {:else}
              <div class="mb-6 flex items-center gap-4 rounded-lg border bg-background/50 p-4">
                <div class="rounded bg-primary/10 p-2 text-primary">
                  {#if status === 'downloading' || status === 'unzipping'}
                    <Spinner class="size-6" />
                  {:else}
                    <FileText class="h-6 w-6" />
                  {/if}
                </div>
                <div class="flex-1 overflow-hidden">
                  <p class="truncate font-medium">{filename}</p>
                  <p class="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
                </div>
              </div>
              <Card.Footer class="flex w-full flex-col gap-6 px-0">
                {#if status === 'downloading' || status === 'unzipping'}
                  <div class="w-full space-y-2">
                    <Progress value={prog.current} class="h-2" />
                    <div class="flex justify-between text-xs text-muted-foreground">
                      <span>{Math.round(prog.current)}%</span>
                      <span class="flex items-center">
                        {#if status === 'unzipping'}
                          <FolderOpen class="mr-2 h-3 w-3 animate-pulse" />Unzipping...
                        {:else}
                          <Download class="mr-2 h-3 w-3 animate-bounce" />Decrypting...
                        {/if}
                      </span>
                    </div>
                  </div>
                {:else}
                  <Button class="w-full" size="lg" onclick={fetchAndUnzip}><Eye class="mr-2 h-4 w-4" />View Contents</Button>
                {/if}
              </Card.Footer>
            {/if}
          </Card.Content>
        </div>
      {/if}
      {#if status === 'listing'}
        {#if viewingFile}
          <div class="w-full" in:fade={{ duration: 200 }}>
            <FileViewerOverlay
              filename={viewingFile.filename}
              contentText={viewingFile.text}
              contentUrl={viewingFile.url}
              onclose={closeViewer}
              oncopylink={copyViewerLink}
              ondownload={() => {
                if (!viewingFile) return;
                const blobUrl = viewingFile.url || URL.createObjectURL(
                  new Blob([viewingFile.text!], { type: 'text/plain' })
                );
                autoDownload(blobUrl, viewingFile.filename.split('/').pop() || 'file');
                if (!viewingFile.url) URL.revokeObjectURL(blobUrl);
              }}
            />
          </div>
        {:else}
          <div class="w-full" in:fade={{ duration: 300 }}>
            <div class="mb-4 flex items-center justify-between">
              <div>
                  <h2 class="text-xl font-bold">Contents of {filename}</h2>
                  <p class="text-sm text-muted-foreground">{zipEntries.length} items found</p>
                </div>
              <Button variant="outline" onclick={downloadOriginal}><Download class="mr-2 h-4 w-4" />Download Original</Button>
            </div>
            <div class="rounded-md border">
              <ScrollArea class="h-125">
                <div class="p-2">
                  {#each zipEntries as entry}
                    <ContextMenu.Root>
                      <ContextMenu.Trigger>
                        <div class="group flex w-full items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
                          <button class="flex flex-1 cursor-pointer items-center gap-3 overflow-hidden border-0 bg-transparent p-0 text-left" onclick={() => openEntry(entry)}>
                            {#if entry.directory}
                              <Folder class="h-5 w-5 shrink-0 text-primary" />
                            {:else}
                              {@const Icon = fileIcon(entry.filename)}
                              <Icon class="h-5 w-5 shrink-0 text-primary" />
                            {/if}
                            <HoverCard.Root>
                              <HoverCard.Trigger class="cursor-default">
                                <div class="flex-1 overflow-hidden">
                                  <p class="truncate text-sm font-medium">{entry.filename}</p>
                                  {#if !entry.directory}
                                    <p class="text-xs text-muted-foreground">{formatFileSize(entry.uncompressedSize)}</p>
                                  {/if}
                                </div>
                              </HoverCard.Trigger>
                              <HoverCard.Content class="w-80">
                                <div class="space-y-2">
                                  <p class="text-sm font-medium">{entry.filename}</p>
                                  {#if !entry.directory}
                                    <p class="text-xs text-muted-foreground">Size: {formatFileSize(entry.uncompressedSize)}</p>
                                  {:else}
                                    <p class="text-xs text-muted-foreground">Directory</p>
                                  {/if}
                                </div>
                              </HoverCard.Content>
                            </HoverCard.Root>
                          </button>
                          {#if !entry.directory}
                            <div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button variant="ghost" size="icon" class="h-8 w-8" title="View File" onclick={() => openEntry(entry)}><ExternalLink class="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" class="h-8 w-8" title="Save File" onclick={() => saveEntry(entry)}><Download class="h-4 w-4" /></Button>
                            </div>
                          {/if}
                        </div>
                      </ContextMenu.Trigger>
                      <ContextMenu.Content class="w-48">
                        {#if !entry.directory}
                          <ContextMenu.Item onclick={() => openEntry(entry)}>View</ContextMenu.Item>
                          <ContextMenu.Item onclick={() => saveEntry(entry)}>Save</ContextMenu.Item>
                        {/if}
                      </ContextMenu.Content>
                    </ContextMenu.Root>
                  {/each}
                  {#if zipEntries.length === 0}<div class="p-8 text-center text-muted-foreground">No files found in this archive.</div>{/if}
                </div>
              </ScrollArea>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
