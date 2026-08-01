<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { CircleAlert, KeyRound } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { page } from '$app/state';
  import { fetchDecryptedBlob } from '$lib/functions/fetch-decrypt';
  import { toast } from 'svelte-sonner';
  import { PasswordRequiredError } from '#errors/password';

  import { detectMimeFromBlob } from '#functions/mime';
  import { createViewableText } from '$lib/functions/viewer';
  import FileViewerOverlay from '$lib/components/FileViewerOverlay.svelte';
  import { autoDownload } from '$lib/functions/browser-download';
  import { validateZipBlob } from '#functions/zip-validate';

  const key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
  const slug = $derived(page.params.slug);
  let status = $state<'loading' | 'needs_password' | 'error' | 'viewing'>('loading');
  let errorMsg = $state('');
  let password = $state('');
  let contentUrl = $state<string | null>(null);
  let contentText = $state<string | null>(null);
  let entryFilename = $state('');

  async function fetchDecryptAndShow() {
    if (!key || !slug) { status = 'error'; errorMsg = 'Missing decryption key'; return; }
    status = 'loading';
    try {
      const blob = await fetchDecryptedBlob(slug, key, password, {});
      await validateZipBlob(blob);
      const mime = await detectMimeFromBlob(blob);
      const viewBlob = mime ? blob.slice(0, blob.size, mime) : blob;
      const text = await createViewableText(viewBlob, mime);
      contentText = text ?? null;
      contentUrl = text === null ? URL.createObjectURL(viewBlob) : null;
      status = 'viewing';
    } catch (e: any) {
      if (e instanceof PasswordRequiredError) {
        status = 'needs_password';
      } else {
        status = 'error';
        errorMsg = e.message?.includes('missing end marker')
          ? 'The archive appears truncated or corrupted on the server.'
          : (e.message || 'Something went wrong');
        toast.error(errorMsg);
      }
    }
  }

  function downloadFile() {
    const url = contentUrl;
    if (!url && contentText === null) return;
    const blobUrl = url || URL.createObjectURL(new Blob([contentText!], { type: 'text/plain' }));
    autoDownload(blobUrl, entryFilename);
    if (!url) URL.revokeObjectURL(blobUrl);
  }

  $effect(() => { fetchDecryptAndShow(); });
</script>

{#if status === 'viewing'}
  <FileViewerOverlay filename={entryFilename} {contentText} {contentUrl} ondownload={downloadFile} />
{:else if status === 'needs_password'}
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-4 text-center">
      <KeyRound class="mx-auto h-10 w-10 text-muted-foreground" />
      <p class="text-lg font-semibold">Password Required</p>
      <div class="flex items-center">
        <Input type="password" placeholder="Password" class="rounded-r-none focus-visible:z-10" bind:value={password} onkeydown={(e) => e.key === 'Enter' && fetchDecryptAndShow()} />
        <Button class="rounded-l-none" onclick={fetchDecryptAndShow}>Unlock</Button>
      </div>
    </div>
  </div>
{:else if status === 'error'}
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-destructive">
    <CircleAlert class="h-10 w-10" /><p class="font-medium">{errorMsg}</p>
  </div>
{:else}
  <div class="flex min-h-screen items-center justify-center"><Spinner class="size-8 text-muted-foreground" /></div>
{/if}
