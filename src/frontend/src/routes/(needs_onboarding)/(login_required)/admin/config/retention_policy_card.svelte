<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Item from '$lib/components/ui/item/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { X } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import { formatSeconds, secondsToNumber, T_UNITS, type TimeUnit } from '#functions/times';
  import type { ConfigQuery } from '$lib/graphql/generated/graphql.js';

  type EditingMode = 'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null;

  let {
    configData,
    editing = $bindable(),
    tempInput = $bindable(),
    save
  }: {
    configData: ConfigQuery['config'];
    editing: EditingMode;
    tempInput: {
      dl: number;
      time: number;
      timeUnit: TimeUnit;
      allowedStr: string;
      bannedStr: string;
    };
    save: (payload: Record<string, unknown>) => Promise<void>;
  } = $props();

  const addTimeItem = (key: string) => {
    const secs = secondsToNumber(tempInput.time, tempInput.timeUnit);
    save({ [key]: [...configData[key as 'timeConfigs'] as number[], secs].sort((a, b) => a - b) });
  };

  const addDlItem = (key: string) => {
    save({ [key]: [...configData[key as 'downloadConfigs'] as number[], tempInput.dl].sort((a, b) => a - b) });
  };

  function toggleMode(mode: EditingMode) {
    if (editing === mode) {
      editing = null;
    } else {
      editing = mode;
      if (mode === 'time') {
        tempInput.time = 1;
        tempInput.timeUnit = 'Hours';
      } else if (mode === 'steps') {
        tempInput.dl = 1;
      }
    }
  }
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
            value={String(configData.defaultExpiry)}
            onValueChange={(v) => save({ defaultExpiry: Number(v) })}
          >
            <Select.Trigger class="w-full bg-background font-mono">
              {@const f = formatSeconds(configData.defaultExpiry)}
              {f.val} {f.unit}
            </Select.Trigger>
            <Select.Content>
              {#each configData.timeConfigs as t}
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
            value={String(configData.defaultNumberOfDownloads)}
            onValueChange={(v) => save({ defaultNumberOfDownloads: Number(v) })}
          >
            <Select.Trigger class="w-full bg-background font-mono">
              {configData.defaultNumberOfDownloads}x
            </Select.Trigger>
            <Select.Content>
              {#each configData.downloadConfigs as dl}
                <Select.Item value={String(dl)} label="{dl}x">{dl}x</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Item.Actions>
      </Item.Root>

      <Item.Separator />

      <!-- Time Presets -->
      <Item.Root class="flex-col items-stretch gap-4">
        <div class="flex items-start justify-between gap-4">
          <Item.Content>
            <Item.Title>Time Presets</Item.Title>
            <Item.Description class="line-clamp-none">Time options available to users.</Item.Description>
          </Item.Content>
          <Item.Actions>
            <Button variant="outline" size="sm" onclick={() => toggleMode('time')}>
              {editing === 'time' ? 'Done' : 'Edit'}
            </Button>
          </Item.Actions>
        </div>

        <Item.Footer class="flex min-h-16 flex-wrap items-center justify-start gap-2 rounded-lg border bg-muted/20 p-4">
          {#each configData.timeConfigs as item, i}
            <Badge variant="secondary" class="h-8 border-border bg-background px-3 text-sm font-normal hover:bg-background">
              {@const label = `${formatSeconds(item).val} ${formatSeconds(item).unit}`}
              {label}
              {#if editing === 'time'}
                <div class="mx-2 h-3 w-px bg-border"></div>
                <button
                  onclick={() => save({ timeConfigs: configData.timeConfigs.filter((_: number, idx: number) => idx !== i) })}
                  class="cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X class="size-3" />
                </button>
              {/if}
            </Badge>
          {/each}
          {#if editing === 'time'}
            <div in:slide class="ml-2 flex items-center gap-2 border-l pl-2">
              <Input type="number" bind:value={tempInput.time} class="h-8 w-20 border-border bg-background" min="1" />
              <Select.Root type="single" bind:value={tempInput.timeUnit}>
                <Select.Trigger class="h-8 w-25 border-border bg-background">{tempInput.timeUnit}</Select.Trigger>
                <Select.Content>
                  {#each T_UNITS as u}
                    <Select.Item value={u} label={u}>{u}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
              <Button size="sm" class="h-8" onclick={() => addTimeItem('timeConfigs')}>Add</Button>
            </div>
          {/if}
        </Item.Footer>
      </Item.Root>

      <Item.Separator />

      <!-- Download Limit Presets -->
      <Item.Root class="flex-col items-stretch gap-4">
        <div class="flex items-start justify-between gap-4">
          <Item.Content>
            <Item.Title>Download Limit Presets</Item.Title>
            <Item.Description class="line-clamp-none">Download count options available to users.</Item.Description>
          </Item.Content>
          <Item.Actions>
            <Button variant="outline" size="sm" onclick={() => toggleMode('steps')}>
              {editing === 'steps' ? 'Done' : 'Edit'}
            </Button>
          </Item.Actions>
        </div>

        <Item.Footer class="flex min-h-16 flex-wrap items-center justify-start gap-2 rounded-lg border bg-muted/20 p-4">
          {#each configData.downloadConfigs as item, i}
            <Badge variant="secondary" class="h-8 border-border bg-background px-3 text-sm font-normal hover:bg-background">
              {@const label = `${item}x`}
              {label}
              {#if editing === 'steps'}
                <div class="mx-2 h-3 w-px bg-border"></div>
                <button
                  onclick={() => save({ downloadConfigs: configData.downloadConfigs.filter((_: number, idx: number) => idx !== i) })}
                  class="cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X class="size-3" />
                </button>
              {/if}
            </Badge>
          {/each}
          {#if editing === 'steps'}
            <div in:slide class="ml-2 flex items-center gap-2 border-l pl-2">
              <Input type="number" bind:value={tempInput.dl} class="h-8 w-20 border-border bg-background" min="1" />
              <Button size="sm" class="h-8" onclick={() => addDlItem('downloadConfigs')}>Add</Button>
            </div>
          {/if}
        </Item.Footer>
      </Item.Root>
    </Item.Group>
  </Card.Content>
</Card.Root>
