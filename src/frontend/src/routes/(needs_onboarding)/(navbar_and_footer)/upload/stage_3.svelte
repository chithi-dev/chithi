<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Lock, Check, Copy, Download, ScanEye, Eye } from '@lucide/svelte';
  import QRCode from '$lib/components/QRCode.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
  import { AspectRatio } from '$lib/components/ui/aspect-ratio/index.js';
  import { toast } from 'svelte-sonner';

  let { finalLink, viewOnceLink, isViewOnce, onReset }: { finalLink: string; viewOnceLink: string; isViewOnce: boolean; onReset: () => void } = $props();
  let isCopied = $state(false);
  const link = $derived(isViewOnce ? viewOnceLink : finalLink);

  const copyLink = () => { navigator.clipboard.writeText(link); isCopied = true; toast.success('Copied the link successfully'); setTimeout(() => isCopied = false, 2000); };
</script>

<div class="col-span-1 flex h-full flex-col items-center justify-center py-12 text-center lg:col-span-2">
  <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10"><Lock class="h-10 w-10 text-green-500" /></div>
  <h2 class="mb-2 text-3xl font-bold tracking-tight">{isViewOnce ? 'Your view-once link is ready' : 'Your file is encrypted and ready to send'}</h2>
  <p class="mb-8 text-muted-foreground">{isViewOnce ? 'This link can only be viewed once:' : 'Copy the link to share your file:'}</p>

  <div class="mb-8 flex w-full max-w-md items-center gap-2"><Input readonly value={link} class="font-mono text-sm" /></div>

  <div class="mb-8 flex flex-col items-center gap-4">
    <AspectRatio ratio={1} class="rounded-lg border bg-white p-2 dark:bg-white max-w-xs">
      <QRCode value={link} size={180} color="#000000" backgroundColor="#ffffff" />
    </AspectRatio>
  </div>

  <div class="flex flex-col gap-4">
    <Tooltip.Provider>
      <ButtonGroup.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <Button variant="outline" size="sm" class="w-32" onclick={copyLink}>
              {#if isCopied}<Check class="mr-2 size-4" /> Copied{:else}<Copy class="mr-2 size-4" /> Copy link{/if}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Copy link to clipboard</Tooltip.Content>
        </Tooltip.Root>
        <ButtonGroup.Separator />
        {#if isViewOnce}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Button variant="outline" size="icon-sm" href={viewOnceLink} aria-label="View once"><ScanEye class="size-4" /></Button>
            </Tooltip.Trigger>
            <Tooltip.Content>View once in browser</Tooltip.Content>
          </Tooltip.Root>
        {:else}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Button variant="outline" size="icon-sm" href={finalLink} aria-label="Download"><Download class="size-4" /></Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Download file</Tooltip.Content>
          </Tooltip.Root>
          <ButtonGroup.Separator />
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Button variant="outline" size="icon-sm" href={finalLink.replace('/download/', '/view/')} aria-label="View"><Eye class="size-4" /></Button>
            </Tooltip.Trigger>
            <Tooltip.Content>View file in browser</Tooltip.Content>
          </Tooltip.Root>
        {/if}
      </ButtonGroup.Root>
    </Tooltip.Provider>
    <Button variant="ghost" onclick={onReset}>Upload more files</Button>
  </div>
</div>
