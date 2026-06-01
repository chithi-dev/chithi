<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Item from '$lib/components/ui/item';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import * as Select from '$lib/components/ui/select';
  import { X } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import { formatSeconds, secondsToNumber, T_UNITS, type TimeUnit } from '#functions/times';

  let {
    configData,
    editing = $bindable(),
    tempInput = $bindable(),
    save
  }: {
    configData: any;
    editing: 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;
    tempInput: {
      dl: number;
      time: number;
      timeUnit: TimeUnit;
      allowedStr: string;
      bannedStr: string;
    };
    save: (payload: any) => Promise<void>;
  } = $props();

  /** Shared preset editor for both time and download limit configs */
  {#snippet presetEditor(
    mode,
    title,
    description,
    configKey,
    inputKey,
    renderItem,
    addItem
  )}
    <Item.Root class="flex-col items-stretch gap-4">
      <div class="flex items-start justify-between gap-4">
        <Item.Content>
          <Item.Title>{title}</Item.Title>
          <Item.Description class="line-clamp-none">{description}</Item.Description>
        </Item.Content>
        <Item.Actions>
          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              editing = editing === mode ? null : mode;
              if (editing === mode) {
                if (inputKey === 'time') {
                  tempInput.time = 1;
                  tempInput.timeUnit = 'Hours';
                } else if (inputKey === 'dl') {
                  tempInput.dl = 1;
                }
              }
            }}
          >
            {editing === mode ? 'Done' : 'Edit'}
          </Button>
        </Item.Actions>
      </div>

      <Item.Footer class="flex min-h-16 flex-wrap items-center justify-start gap-2 rounded-lg border bg-muted/20 p-4">
        {#each configData[configKey] as item, i}
          <Badge
            variant="secondary"
            class="h-8 border-border bg-background px-3 text-sm font-normal hover:bg-background"
          >
            {@const label = renderItem(item)}
            {label}
            {#if editing === mode}
              <div class="mx-2 h-3 w-px bg-border"></div>
              <button
                onclick={() =>
                  save({
                    [configKey]: configData[configKey].filter((_: any, idx: number) => idx !== i)
                  })}
                class="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X class="size-3" />
              </button>
            {/if}
          </Badge>
        {/each}
        {#if editing === mode}
          <div in:slide class="ml-2 flex items-center gap-2 border-l pl-2">
            {#if inputKey === 'time'}
              <Input
                type="number"
                bind:value={tempInput.time}
                class="h-8 w-20 border-border bg-background"
                min="1"
              />
              <Select.Root type="single" bind:value={tempInput.timeUnit}>
                <Select.Trigger class="h-8 w-25 border-border bg-background"
                  >{tempInput.timeUnit}</Select.Trigger
                >
                <Select.Content>
                  {#each T_UNITS as u}
                    <Select.Item value={u} label={u}>{u}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else if inputKey === 'dl'}
              <Input
                type="number"
                bind:value={tempInput.dl}
                class="h-8 w-20 border-border bg-background"
                min="1"
              />
            {/if}
            <Button size="sm" class="h-8" onclick={() => addItem(configKey)}>Add</Button>
          </div>
        {/if}
      </Item.Footer>
    </Item.Root>
  {/snippet}

  const addTimeItem = (key: string) => {
    const secs = secondsToNumber(tempInput.time, tempInput.timeUnit);
    save({ [key]: [...configData[key], secs].sort((a: number, b: number) => a - b) });
  };

  const addDlItem = (key: string) => {
    save({ [key]: [...configData[key], tempInput.dl].sort((a: number, b: number) => a - b) });
  };
</script>

<Card.Root class="border bg-background">
  <Card.Header class="px-6 py-4">
    <Card.Title class="text-base font-medium">Retention Policy</Card.Title>
  </Card.Header>
  <Card.Content class="p-0">
    <Item.Group>
      <Item.Root>
        <Item.Content>
          <Item.Title>Default Expiry</Item.Title>
          <Item.Description class="line-clamp-none text-wrap">
            The default retention period applied to uploads if none is specified.
          </Item.Description>
        </Item.Content>
        <Item.Actions class="w-full md:w-auto md:min-w-75">
          <Select.Root
            type="single"
            value={String(configData.default_expiry)}
            onValueChange={(v) => save({ default_expiry: Number(v) })}
          >
            <Select.Trigger class="w-full bg-background font-mono">
              {@const f = formatSeconds(configData.default_expiry)}
              {f.val} {f.unit}
            </Select.Trigger>
            <Select.Content>
              {#each configData.time_configs as t}
                {@const f = formatSeconds(t)}
                <Select.Item value={String(t)} label="{f.val} {f.unit}">{f.val} {f.unit}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Item.Actions>
      </Item.Root>

      <Item.Separator />

      <Item.Root>
        <Item.Content>
          <Item.Title>Default Download Limit</Item.Title>
          <Item.Description class="line-clamp-none text-wrap">
            The default maximum number of downloads for a file.
          </Item.Description>
        </Item.Content>
        <Item.Actions class="w-full md:w-auto md:min-w-75">
          <Select.Root
            type="single"
            value={String(configData.default_number_of_downloads)}
            onValueChange={(v) => save({ default_number_of_downloads: Number(v) })}
          >
            <Select.Trigger class="w-full bg-background font-mono">
              {configData.default_number_of_downloads}x
            </Select.Trigger>
            <Select.Content>
              {#each configData.download_configs as dl}
                <Select.Item value={String(dl)} label="{dl}x">{dl}x</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Item.Actions>
      </Item.Root>

      <Item.Separator />

      {@presetEditor(
        'time',
        'Time Presets',
        'Time options available to users.',
        'time_configs',
        'time',
        (t: number) => `${formatSeconds(t).val} ${formatSeconds(t).unit}`,
        addTimeItem
      )}

      <Item.Separator />

      {@presetEditor(
        'steps',
        'Download Limit Presets',
        'Download count options available to users.',
        'download_configs',
        'dl',
        (dl: number) => `${dl}x`,
        addDlItem
      )}
    </Item.Group>
  </Card.Content>
</Card.Root>
