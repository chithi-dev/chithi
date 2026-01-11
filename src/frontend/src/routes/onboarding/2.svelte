<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Settings, Check, LoaderCircle, ArrowRight } from 'lucide-svelte';
	import { useConfigQuery } from '$lib/queries/config';
	import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '$lib/functions/bytes';
	import { toast } from 'svelte-sonner';

	interface Props {
		onNext: () => void;
	}
	let { onNext }: Props = $props();

	const { config: configQuery, update_config } = useConfigQuery();

	let configData = $derived(configQuery.data);
	let isLoading = $state(false);

	// Temp state for form
	let storageLimitVal = $state(0);
	let storageLimitUnit = $state<ByteUnit>('GB');
	let maxFileVal = $state(0);
	let maxFileUnit = $state<ByteUnit>('MB');
	let description = $state('');

	// Initialize form when data loads
	$effect(() => {
		if (configData) {
			const s = formatBytes(configData.total_storage_limit);
			storageLimitVal = s.val;
			storageLimitUnit = s.unit;

			const f = formatBytes(configData.max_file_size_limit);
			maxFileVal = f.val;
			maxFileUnit = f.unit;

			description = configData.site_description || '';
		}
	});

	async function handleSave() {
		isLoading = true;
		try {
			await update_config({
				total_storage_limit_gb: bytesToNumber(storageLimitVal, storageLimitUnit),
				max_file_size_mb: bytesToNumber(maxFileVal, maxFileUnit),
				site_description: description
			});
			toast.success('Configuration saved');
			onNext();
		} catch (error: any) {
			toast.error('Failed to save config: ' + error.message);
		} finally {
			isLoading = false;
		}
	}
</script>

<Card.Root
	class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
>
	<div
		class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
	></div>

	<Card.Header class="space-y-3 pt-10 pb-6 text-center">
		<div
			class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20"
		>
			<Settings class="size-8" />
		</div>
		<div class="space-y-1">
			<Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
				>Quick Configuration</Card.Title
			>
			<Card.Description class="text-sm text-slate-500 dark:text-zinc-400">
				Set up your instance basics. You can change these later.
			</Card.Description>
		</div>
	</Card.Header>

	<Card.Content>
		{#if configQuery.isLoading}
			<div class="flex h-60 items-center justify-center">
				<LoaderCircle class="size-8 animate-spin text-primary" />
			</div>
		{:else}
			<div class="grid gap-6">
				<!-- Storage Limit -->
				<div class="grid gap-3">
					<Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
						>Total Storage Limit</Label
					>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={storageLimitVal}
							min="0"
							step="0.01"
							class="bg-white/50 dark:bg-zinc-950/50"
						/>
						<Select.Root type="single" bind:value={storageLimitUnit}>
							<Select.Trigger class="w-24 bg-white/50 dark:bg-zinc-950/50"
								>{storageLimitUnit}</Select.Trigger
							>
							<Select.Content>
								{#each Object.keys(B_VALS) as u}
									<Select.Item value={u} label={u}>{u}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<p class="px-1 text-xs text-slate-500 dark:text-zinc-500">
						Total capacity for your Chithi instance.
					</p>
				</div>

				<!-- Max File Size -->
				<div class="grid gap-3">
					<Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
						>Max File Size</Label
					>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={maxFileVal}
							min="0"
							step="0.01"
							class="bg-white/50 dark:bg-zinc-950/50"
						/>
						<Select.Root type="single" bind:value={maxFileUnit}>
							<Select.Trigger class="w-24 bg-white/50 dark:bg-zinc-950/50"
								>{maxFileUnit}</Select.Trigger
							>
							<Select.Content>
								{#each Object.keys(B_VALS) as u}
									<Select.Item value={u} label={u}>{u}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<p class="px-1 text-xs text-slate-500 dark:text-zinc-500">
						Maximum size for a single upload.
					</p>
				</div>

				<!-- Site Description -->
				<div class="grid gap-3">
					<Label class="ml-1 text-sm font-medium text-slate-700 dark:text-zinc-400"
						>Site Description</Label
					>
					<Input
						bind:value={description}
						placeholder="Welcome to my simplified file sharing..."
						class="bg-white/50 dark:bg-zinc-950/50"
					/>
					<p class="px-1 text-xs text-slate-500 dark:text-zinc-500">
						Displayed on the home page. Supports Markdown.
					</p>
				</div>

				<Button
					type="button"
					onclick={handleSave}
					disabled={isLoading}
					class="mt-2 h-12 w-full font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
				>
					{#if isLoading}
						<LoaderCircle class="mr-2 size-5 animate-spin" />
						Saving...
					{:else}
						Finish Setup
						<Check class="ml-2 size-5" />
					{/if}
				</Button>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
