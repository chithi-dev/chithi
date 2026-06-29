<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Field from '$lib/components/ui/field/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import type { Props } from './types';
  import { Settings, Check } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { useConfigQuery } from '#queries/config';
  import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '#functions/bytes';
  import { toast } from 'svelte-sonner';

  let { onNext }: Props = $props();
  const { config: configQuery, updateConfig } = useConfigQuery();
  let configData = $derived(configQuery.data);
  let isLoading = $state(false);
  let storageLimitVal = $state(0);
  let storageLimitUnit = $state<ByteUnit>('GB');
  let maxFileVal = $state(0);
  let maxFileUnit = $state<ByteUnit>('MB');
  let description = $state('');

  $effect(() => {
    if (configData) {
      const s = formatBytes(configData.total_storage_limit); storageLimitVal = s.val; storageLimitUnit = s.unit;
      const f = formatBytes(configData.max_file_size_limit); maxFileVal = f.val; maxFileUnit = f.unit;
      description = configData.site_description || '';
    }
  });

  async function handleSave() {
    isLoading = true;
    try { await updateConfig({ total_storage_limit: bytesToNumber(storageLimitVal, storageLimitUnit), max_file_size_limit: bytesToNumber(maxFileVal, maxFileUnit), site_description: description }); toast.success('Configuration saved'); onNext(); }
    catch (error: any) { toast.error('Failed to save config: ' + error.message); }
    finally { isLoading = false; }
  }
</script>

<Card.Root class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50">
  <div class="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"></div>
  <Card.Header class="space-y-3 pt-10 pb-6 text-center">
    <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20"><Settings class="size-8" /></div>
    <div class="space-y-1"><Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Quick Configuration</Card.Title><Card.Description class="text-sm text-slate-500 dark:text-zinc-400">Set up your instance basics. You can change these later.</Card.Description></div>
  </Card.Header>
  <Card.Content>
    {#if configQuery.isLoading}
      <div class="flex h-60 items-center justify-center"><Spinner class="size-8 text-primary" /></div>
    {:else}
      <div class="grid gap-6">
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400">Total Storage Limit</Field.Label>
          <Field.Content>
            <div class="flex gap-2"><Input type="number" bind:value={storageLimitVal} min="0" step="0.01" class="bg-white/50 dark:bg-zinc-950/50" /><Select.Root type="single" bind:value={storageLimitUnit}><Select.Trigger class="w-24 bg-white/50 dark:bg-zinc-950/50">{storageLimitUnit}</Select.Trigger><Select.Content>{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}</Select.Content></Select.Root></div>
          </Field.Content>
          <Field.Description class="px-1 text-xs text-slate-500 dark:text-zinc-500">Total capacity for your Chithi instance.</Field.Description>
        </Field.Field>
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400">Max File Size</Field.Label>
          <Field.Content>
            <div class="flex gap-2"><Input type="number" bind:value={maxFileVal} min="0" step="0.01" class="bg-white/50 dark:bg-zinc-950/50" /><Select.Root type="single" bind:value={maxFileUnit}><Select.Trigger class="w-24 bg-white/50 dark:bg-zinc-950/50">{maxFileUnit}</Select.Trigger><Select.Content>{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}</Select.Content></Select.Root></div>
          </Field.Content>
          <Field.Description class="px-1 text-xs text-slate-500 dark:text-zinc-500">Maximum size for a single upload.</Field.Description>
        </Field.Field>
        <Field.Field class="grid gap-3">
          <Field.Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400">Site Description</Field.Label>
          <Field.Content>
            <Input bind:value={description} placeholder="Welcome to my simplified file sharing..." class="bg-white/50 dark:bg-zinc-950/50" />
          </Field.Content>
          <Field.Description class="px-1 text-xs text-slate-500 dark:text-zinc-500">Displayed on the home page. Supports Markdown.</Field.Description>
        </Field.Field>
        <Button type="button" onclick={handleSave} disabled={isLoading} class="mt-2 h-12 w-full font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70">
          {#if isLoading}<Spinner />Saving...{:else}Finish Setup<Check class="ml-2 size-5" />{/if}
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
