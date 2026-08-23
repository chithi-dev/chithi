<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as InputGroup from '$lib/components/ui/input-group/index.js';
  import { FileText, CircleAlert, Download, KeyRound, HardDrive, File } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import * as HoverCard from '$lib/components/ui/hover-card/index.js';
  import { page } from '$app/state';
  import { fly } from 'svelte/transition';
  import { downloadAndDecryptFile } from '#functions/download';
  import { PasswordRequiredError } from '#errors/password';
  import { formatFileSize } from '#functions/bytes';
  import { toast } from 'svelte-sonner';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import CompleteSvg from '$lib/svgs/complete.svelte';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
  import { FileInfoDocument, type FileInfoQuery } from '$lib/graphql/generated/graphql.js';

  const key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
  const slug = $derived(page.params.slug);
  let phase = $state<'ready' | 'downloading' | 'needs_password' | 'completed' | 'error'>('ready');
  const fileInfoState = createQueryStore<FileInfoQuery>(FileInfoDocument, { slug: slug ?? '' });
  const fileInfo = $derived({
    isPending: fileInfoState.fetching,
    isError: !!fileInfoState.error,
    error: fileInfoState.error ? new Error(fileInfoState.error) : undefined,
    data: fileInfoState.data?.fileInfo
      ? { filename: fileInfoState.data.fileInfo.filename || 'file', fileSize: fileInfoState.data.fileInfo.size || 0, numberOfFiles: fileInfoState.data.fileInfo.numberOfFiles ?? 0 }
      : undefined
  });
  const hasKey = $derived(Boolean(key && slug));
  const status = $derived(hasKey && fileInfo.isPending ? 'checking' : hasKey && fileInfo.isError ? 'error' : phase);
  const errorMsg = $derived(fileInfo.error?.message ?? 'An error occurred');
  const filename = $derived(fileInfo.data?.filename ?? 'file');
  const fileSize = $derived(fileInfo.data?.fileSize ?? 0);
  let password = $state('');
  let prog = $state(new Tween(0, { duration: 500, easing: cubicOut }));

  async function handleDownload() {
    if (!key || !slug) return;
    const prev = phase;
    phase = 'downloading';
    prog = new Tween(0, { duration: 500, easing: cubicOut });
    try {
      const numberOfFiles = fileInfo.data?.numberOfFiles ?? 0;
      await downloadAndDecryptFile(slug, key, password, filename, fileSize, numberOfFiles, (p) => prog.target = p);
      phase = 'completed';
      toast.success('Download complete');
      if (password) toast.info('Note: The downloaded zip file is also encrypted with your password.');
    } catch (e: any) {
      if (e instanceof PasswordRequiredError) {
        phase = 'needs_password';
        toast.info('Password required for decryption');
      } else if (prev === 'needs_password' && password) {
        toast.error('Download failed: Incorrect password?');
        phase = 'needs_password';
      } else if (e.name === 'AbortError') {
        phase = 'ready';
      } else {
        toast.error('Download failed: ' + e.message);
        phase = 'error';
      }
    }
  }
</script>

<Card.Root class="relative z-10 mx-auto w-full max-w-5xl border-border bg-card">
  <Card.Content class="p-6">
    <div class="flex min-h-150 flex-col items-center justify-center">
      <div class="w-full max-w-lg">
        <Card.Header class="px-0 text-center">
          <Card.Title class="text-2xl font-bold">Download files</Card.Title>
          <Card.Description class="text-muted-foreground">This file was shared via Chithi with end-to-end encryption and a link that automatically expires.</Card.Description>
        </Card.Header>
        <Card.Content class="w-full px-0">
          {#if status === 'checking'}
            <div class="flex flex-col items-center justify-center py-8">
              <Spinner class="mb-4 size-8 text-primary" />
              <p class="text-muted-foreground">Verifying key and checking file...</p>
            </div>
          {:else if status === 'error'}
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
                  <Button class="w-full cursor-pointer" variant="outline" href="/">Go Home</Button>
                </Card.Footer>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center py-8 text-destructive">
                <CircleAlert class="mb-4 h-12 w-12" />
                <p class="font-medium">{errorMsg}</p>
              </div>
            {/if}
          {:else if status === 'needs_password'}
            <div class="mx-auto flex w-full max-w-sm flex-col items-center gap-2 py-8">
              <InputGroup.Root class="w-full">
                <Input type="password" placeholder="Password" bind:value={password} onkeydown={(e) => e.key === 'Enter' && handleDownload()} />
                <InputGroup.Button>
                  <Button onclick={handleDownload}>Unlock</Button>
                </InputGroup.Button>
              </InputGroup.Root>
              <p class="text-xs text-muted-foreground">Enter password to decrypt the download.</p>
            </div>
          {:else if status === 'completed'}
            <div in:fly={{ y: 10, duration: 400 }} class="flex flex-col items-center justify-center py-4">
              <div class="mb-6 flex flex-col items-center text-muted-foreground">
                <CompleteSvg class="pointer-events-none select-none" />
              </div>
              <div class="flex w-full gap-3 pt-2">
                <Button variant="outline" class="flex-1" href="/">Go home</Button>
                <Button class="flex-1" onclick={() => phase = 'ready'}>Download Again</Button>
              </div>
            </div>
          {:else}
            <HoverCard.Root>
              <HoverCard.Trigger class="mb-6 flex w-full items-center gap-4 rounded-lg border bg-background/50 p-4 cursor-default">
                <div class="rounded bg-primary/10 p-2 text-primary">
                  {#if status === 'downloading'}
                    <Download class="h-6 w-6" />
                  {:else}
                    <FileText class="h-6 w-6" />
                  {/if}
                </div>
                <div class="flex-1 overflow-hidden">
                  <p class="truncate font-medium">{filename}</p>
                  <p class="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
                </div>
              </HoverCard.Trigger>
              <HoverCard.Content class="w-80">
                <div class="space-y-2">
                  <p class="text-sm font-medium">{filename}</p>
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <HardDrive class="h-3 w-3" />
                    <span>{formatFileSize(fileSize)}</span>
                  </div>
                  {#if fileInfo.data?.numberOfFiles}
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <File class="h-3 w-3" />
                      <span>{fileInfo.data.numberOfFiles} file{fileInfo.data.numberOfFiles === 1 ? '' : 's'}</span>
                    </div>
                  {/if}
                </div>
              </HoverCard.Content>
            </HoverCard.Root>
            <Card.Footer class="flex w-full flex-col gap-6 px-0">
              {#if status === 'downloading'}
                <div class="w-full space-y-2">
                  <Progress value={prog.current} class="h-2" />
                  <div class="flex justify-between text-xs text-muted-foreground">
                    <span>{Math.round(prog.current)}%</span>
                    <span class="flex items-center">
                      <Download class="mr-2 h-3 w-3 animate-bounce" />
                      Decrypting & Downloading...
                    </span>
                  </div>
                </div>
              {:else}
                <Button class="w-full cursor-pointer" size="lg" onclick={handleDownload}>
                  <Download class="mr-2 h-4 w-4" />
                  Download
                </Button>
              {/if}
            </Card.Footer>
          {/if}
        </Card.Content>
      </div>
    </div>
  </Card.Content>
</Card.Root>
