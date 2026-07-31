<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Field from '$lib/components/ui/field/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import type { Props } from './types';
  import { Settings, Check } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '#functions/bytes';
  import { toast } from 'svelte-sonner';
  import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
  import { ConfigDocument, UpdateConfigDocument } from '$lib/graphql/generated/graphql.js';
  import type { ConfigQuery, UpdateConfigMutation } from '$lib/graphql/generated/graphql.js';
  import { client } from '$lib/graphql/client.js';

  let { onNext }: Props = $props();
  const configQuery = createQueryStore<ConfigQuery>(ConfigDocument);
  let configData = $derived(configQuery.data?.config);
  let isLoading = $state(false);
  let storageLimitVal = $state(0);
  let storageLimitUnit = $state<ByteUnit>('GB');
  let maxFileVal = $state(0);
  let maxFileUnit = $state<ByteUnit>('MB');
  let description = $state('');

  $effect(() => {
    if (configData) {
      const s = formatBytes(configData.totalStorageLimit); storageLimitVal = s.val; storageLimitUnit = s.unit;
      const f = formatBytes(configData.maxFileSizeLimit); maxFileVal = f.val; maxFileUnit = f.unit;
      description = configData.siteDescription || '';
    }
  });

  async function handleSave() {
    isLoading = true;
    try {
      const result = await client.mutate<UpdateConfigMutation>({
        mutation: UpdateConfigDocument,
        variables: {
          totalStorageLimit: bytesToNumber(storageLimitVal, storageLimitUnit),
          maxFileSizeLimit: bytesToNumber(maxFileVal, maxFileUnit),
          siteDescription: description
        }
      });
      if (result.error) throw new Error(result.error.message);
      toast.success('Configuration saved');
      onNext();
    } catch (error: any) { toast.error('Failed to save config: ' + error.message); }
    finally { isLoading = false; }
  }
</script>

<Card.Root class="relative overflow-hidden border-border/60 bg-card/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
  <div class="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"></div>
  <Card.Header class="space-y-3 pt-10 pb-6 text-center">
    <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"><Settings class="size-8" /></div>
    <div class="space-y-1"><Card.Title class="text-2xl font-semibold tracking-tight text-foreground">Quick Configuration</Card.Title><Card.Description class="text-sm text-muted-foreground">Set up your instance basics. You can change these later.</Card.Description></div>
  </Card.Header>
  <Card.Content>
    {#if configQuery.isLoading}
      <div class="flex h-60 items-center justify-center"><Spinner class="size-8 text-primary" /></div>
    {:else}
      <div class="grid gap-6">
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Total Storage Limit</Field.Label>
          <Field.Content>
            <div class="flex gap-2"><Input type="number" bind:value={storageLimitVal} min="0" step="0.01" class="bg-background/50" /><Select.Root type="single" bind:value={storageLimitUnit}><Select.Trigger class="w-24 bg-background/50">{storageLimitUnit}</Select.Trigger><Select.Content>{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}</Select.Content></Select.Root></div>
          </Field.Content>
          <Field.Description class="px-1 text-xs text-muted-foreground">Total capacity for your Chithi instance.</Field.Description>
        </Field.Field>
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Max File Size</Field.Label>
          <Field.Content>
            <div class="flex gap-2"><Input type="number" bind:value={maxFileVal} min="0" step="0.01" class="bg-background/50" /><Select.Root type="single" bind:value={maxFileUnit}><Select.Trigger class="w-24 bg-background/50">{maxFileUnit}</Select.Trigger><Select.Content>{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}</Select.Content></Select.Root></div>
          </Field.Content>
          <Field.Description class="px-1 text-xs text-muted-foreground">Maximum size for a single upload.</Field.Description>
        </Field.Field>
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-foreground">Site Description</Field.Label>
          <Field.Content>
            <Input bind:value={description} placeholder="Welcome to my simplified file sharing..." class="bg-background/50" />
          </Field.Content>
          <Field.Description class="px-1 text-xs text-muted-foreground">Displayed on the home page. Supports Markdown.</Field.Description>
        </Field.Field>
        <Button type="button" onclick={handleSave} disabled={isLoading} class="mt-2 h-12 w-full font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70">
          {#if isLoading}<Spinner />Saving...{:else}Finish Setup<Check class="ml-2 size-5" />{/if}
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
