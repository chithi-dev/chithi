<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Item from '$lib/components/ui/item/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { X } from '@lucide/svelte';
  import { sanitizeExt } from '#functions/sanitize';
  import type { Config } from '#queries/config';

  let {
    configData,
    editing = $bindable(),
    tempInput = $bindable(),
    save
  }: {
    configData: Config;
    editing: 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;
    tempInput: { allowedStr: string; bannedStr: string };
    save: (payload: any) => Promise<void>;
  } = $props();

  const addAllowed = () => {
    const ext = sanitizeExt(tempInput.allowedStr);
    if (!ext) return;
    save({ allowed_file_types: [...new Set([...(configData.allowed_file_types || []), ext])] });
    tempInput.allowedStr = '';
  };

  const addBanned = () => {
    const ext = sanitizeExt(tempInput.bannedStr);
    if (!ext) return;
    save({ banned_file_types: [...new Set([...(configData.banned_file_types || []), ext])] });
    tempInput.bannedStr = '';
  };
</script>

<Card.Root class="border bg-background">
  <Card.Header class="px-6 py-4">
    <Card.Title class="text-base font-medium">File Security</Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-4 p-6 pt-0 md:grid-cols-2">
    <!-- Allowed Extensions -->
    <Item.Root variant="outline" class="block p-4">
      <div class="space-y-4">
        <Item.Content>
          <Item.Title>Allowed Extensions</Item.Title>
          <Item.Description class="line-clamp-none">Whitelist specific file types.</Item.Description>
        </Item.Content>
        <Item.Actions>
          <div class="flex w-full items-center gap-2">
            <Input
              placeholder="Add extension (e.g. pdf)..."
              bind:value={tempInput.allowedStr}
              onkeydown={(e: KeyboardEvent) => {
                if (editing === 'allowed' && e.key === 'Enter') addAllowed();
              }}
              onfocus={() => (editing = 'allowed')}
              class="min-w-0 flex-1 bg-background"
            />
            {#if editing === 'allowed' && tempInput.allowedStr}
              <Button size="sm" onclick={addAllowed}>Add</Button>
            {/if}
          </div>
        </Item.Actions>
        <Item.Footer class="flex min-h-10 flex-wrap justify-start gap-2 rounded-md border bg-muted/20 p-3">
          {#if !configData.allowed_file_types?.length}
            <span class="p-1 text-xs text-muted-foreground italic">All files types are allowed.</span>
          {:else}
            {#each configData.allowed_file_types as type}
              <Badge variant="outline" class="gap-1 border-emerald-500/20 bg-emerald-500/10 pr-1 text-emerald-600">
                {type}
                <button
                  onclick={() => save({ allowed_file_types: configData.allowed_file_types.filter((t: string) => t !== type) })}
                  class="cursor-pointer rounded-full p-0.5 hover:bg-emerald-500/20"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            {/each}
          {/if}
        </Item.Footer>
      </div>
    </Item.Root>

    <!-- Banned Extensions -->
    <Item.Root variant="outline" class="block p-4">
      <div class="space-y-4">
        <Item.Content>
          <Item.Title>Banned Extensions</Item.Title>
          <Item.Description class="line-clamp-none">Blacklist specific file types.</Item.Description>
        </Item.Content>
        <Item.Actions>
          <div class="flex w-full items-center gap-2">
            <Input
              placeholder="Add extension (e.g. exe)..."
              bind:value={tempInput.bannedStr}
              onkeydown={(e: KeyboardEvent) => {
                if (editing === 'banned' && e.key === 'Enter') addBanned();
              }}
              onfocus={() => (editing = 'banned')}
              class="min-w-0 flex-1 bg-background"
            />
            {#if editing === 'banned' && tempInput.bannedStr}
              <Button size="sm" onclick={addBanned}>Add</Button>
            {/if}
          </div>
        </Item.Actions>
        <Item.Footer class="flex min-h-10 flex-wrap justify-start gap-2 rounded-md border bg-muted/20 p-3">
          {#if !configData.banned_file_types?.length}
            <span class="p-1 text-xs text-muted-foreground italic">No file types are banned.</span>
          {:else}
            {#each configData.banned_file_types as type}
              <Badge variant="outline" class="gap-1 border-destructive/20 bg-destructive/10 pr-1 text-destructive">
                {type}
                <button
                  onclick={() => save({ banned_file_types: configData.banned_file_types.filter((t: string) => t !== type) })}
                  class="cursor-pointer rounded-full p-0.5 hover:bg-destructive/20"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            {/each}
          {/if}
        </Item.Footer>
      </div>
    </Item.Root>
  </Card.Content>
</Card.Root>
