<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Item from '$lib/components/ui/item/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Switch } from '$lib/components/ui/switch/index.js';
  import { slide } from 'svelte/transition';
  import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '#functions/bytes';
  import type { Config } from '#queries/config';

  let {
    configData,
    editing = $bindable(),
    editVal = $bindable(),
    editUnit = $bindable(),
    startEdit,
    save
  }: {
    configData: Config;
    editing: 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;
    editVal: number;
    editUnit: ByteUnit;
    startEdit: (type: 'storage' | 'file') => void;
    save: (payload: any) => Promise<void>;
  } = $props();

  const sizeConfigs = $derived.by(() => {
    const configs: {
      key: 'total_storage_limit' | 'max_file_size_limit';
      editKey: 'storage' | 'file';
      title: string;
      description: string;
    }[] = [
      {
        key: 'total_storage_limit',
        editKey: 'storage',
        title: 'Storage Limit',
        description:
          'The total storage capacity allocated for this instance. Older files may be pruned if this limit is reached.',
      },
      {
        key: 'max_file_size_limit',
        editKey: 'file',
        title: 'Max File Size',
        description: 'The permissible size limit for a single file upload.',
      },
    ];
    return configs;
  });
</script>

<Card.Root class="border bg-background">
  <Card.Header class="px-6 py-4">
    <Card.Title class="text-base font-medium">Storage & Files</Card.Title>
  </Card.Header>
  <Card.Content class="p-0">
    <Item.Group>
      {#each sizeConfigs as cfg, i}
        {#if i > 0}<Item.Separator />{/if}
        <Item.Root>
          <Item.Content>
            <Item.Title>{cfg.title}</Item.Title>
            <Item.Description class="line-clamp-none text-wrap">{cfg.description}</Item.Description>
          </Item.Content>
          <Item.Actions class="w-full flex-col items-end gap-2 md:w-auto md:min-w-75">
            {#if editing === cfg.editKey}
              <div in:slide class="flex w-full gap-2">
                <Input type="number" bind:value={editVal} class="bg-background" min="0" step="0.01" />
                <Select.Root type="single" bind:value={editUnit}>
                  <Select.Trigger class="w-25">{editUnit}</Select.Trigger>
                  <Select.Content>
                    {#each Object.keys(B_VALS) as u}
                      <Select.Item value={u} label={u}>{u}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="flex gap-2">
                <Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
                <Button
                  size="sm"
                  onclick={() => {
                    save({ [cfg.key]: bytesToNumber(editVal, editUnit) });
                    editing = null;
                  }}>Save</Button
                >
              </div>
            {:else}
              {@const f = formatBytes(configData[cfg.key])}
              <div
                class="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <span class="font-mono font-medium">{f.val} {f.unit}</span>
              </div>
              <Button variant="outline" size="sm" onclick={() => startEdit(cfg.editKey)}>Edit</Button>
            {/if}
          </Item.Actions>
        </Item.Root>
      {/each}

      <Item.Separator />

      <Item.Root>
        <Item.Content>
          <Item.Title>Allow Uploads</Item.Title>
          <Item.Description class="line-clamp-none text-wrap">
            Enable or disable file uploads on this instance. Existing files can still be downloaded.
          </Item.Description>
        </Item.Content>
        <Item.Actions
          class="flex w-full items-center justify-end gap-2 md:w-auto md:min-w-75 [&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[calc(100%-2px)] [&_[data-slot=switch-thumb][data-state=unchecked]]:translate-x-0 [&_[data-slot=switch][data-state=checked]]:bg-primary [&_[data-slot=switch][data-state=unchecked]]:bg-input"
        >
          <Switch
            checked={configData.allow_uploads}
            onCheckedChange={(checked) => save({ allow_uploads: checked })}
          />
        </Item.Actions>
      </Item.Root>
    </Item.Group>
  </Card.Content>
</Card.Root>
