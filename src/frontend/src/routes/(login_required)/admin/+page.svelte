<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import {
		HardDrive,
		FileCode,
		Download,
		Globe,
		Pencil,
		X,
		Settings2,
		LoaderCircle
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { marked } from 'marked';
	import { useConfigQuery } from '$lib/queries/config';

	// --- TYPES & CONSTANTS ---
	const B_VALS = {
		Bytes: 1,
		KB: 1024,
		MB: 1024 ** 2,
		GB: 1024 ** 3,
		TB: 1024 ** 4
	} as const;
	type ByteUnit = keyof typeof B_VALS;

	const T_VALS = {
		Seconds: 1,
		Minutes: 60,
		Hours: 3600,
		Days: 86400,
		Weeks: 604800,
		Months: 2592000
	} as const;
	type TimeUnit = keyof typeof T_VALS;
	const T_UNITS = Object.keys(T_VALS) as TimeUnit[];

	// --- QUERY HOOK ---
	// Note: TanStack Query v5 returns reactive properties directly in Svelte 5.
	const { config: configQuery, update_config } = useConfigQuery();

	// --- DERIVED STATE (Runes) ---
	let configData = $derived(configQuery.data);
	let selectedExpiry = $derived(String(configData?.default_expiry ?? ''));
	let selectedDownloads = $derived(String(configData?.default_number_of_downloads ?? ''));

	// Explicitly handle the promise/string return of marked
	let previewHtml = $derived(
		configData?.site_description ? marked.parse(configData.site_description) : ''
	);

	// --- UI STATE (Runes) ---
	let editing = $state<'storage' | 'file' | 'steps' | 'desc' | null>(null);
	let editVal = $state(0);
	let editUnit = $state<ByteUnit>('GB');
	let tempInput = $state({
		dl: 0,
		timeUnit: 'Hours' as TimeUnit
	});

	// --- HELPERS ---
	function formatBytes(bytes: number): { val: number; unit: ByteUnit } {
		if (!bytes || bytes === 0) return { val: 0, unit: 'MB' };
		const units: ByteUnit[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return {
			val: parseFloat((bytes / Math.pow(1024, i)).toFixed(2)),
			unit: units[i]
		};
	}

	function formatSeconds(seconds: number): { val: number; unit: TimeUnit } {
		if (!seconds || seconds === 0) return { val: 0, unit: 'Seconds' };
		for (const unit of [...T_UNITS].reverse()) {
			if (seconds % T_VALS[unit] === 0) return { val: seconds / T_VALS[unit], unit };
		}
		return { val: seconds, unit: 'Seconds' };
	}

	function startEdit(type: 'storage' | 'file') {
		if (!configData) return;
		const bytes =
			type === 'storage'
				? configData.total_storage_limit_gb * B_VALS.GB
				: configData.max_file_size_mb * B_VALS.MB;
		const f = formatBytes(bytes);
		editVal = f.val;
		editUnit = f.unit;
		editing = type;
	}

	async function save(payload: any) {
		await update_config(payload);
		editing = null;
	}
</script>

<div class="min-h-screen bg-[#050505] p-8 text-zinc-300">
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex items-center justify-between border-b border-zinc-900 pb-8">
			<div class="flex items-center gap-4">
				<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
					<Settings2 class="size-6 text-white" />
				</div>
				<h1 class="text-3xl font-black tracking-tight text-white uppercase italic">
					Chithi <span class="font-light text-zinc-600 not-italic">Engine</span>
				</h1>
			</div>
			{#if configQuery.isFetching}
				<div
					in:fade
					class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
				>
					<LoaderCircle class="size-3 animate-spin" /> Syncing
				</div>
			{/if}
		</header>

		{#if configQuery.isLoading}
			<div
				class="flex h-64 items-center justify-center font-mono text-xs tracking-widest text-zinc-600"
			>
				LOADING_SYSTEM_CONFIG...
			</div>
		{:else if configData}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none">
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<HardDrive class="size-4 text-emerald-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Storage Pool</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8 border-zinc-800 bg-zinc-900 hover:bg-emerald-500"
							onclick={() => startEdit('storage')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'storage'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input type="number" bind:value={editVal} class="h-8 border-zinc-800 bg-black" />
									<Select.Root type="single" bind:value={editUnit as string}>
										<Select.Trigger
											class="h-8 w-22 border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
											{#each Object.keys(B_VALS) as u}
												<Select.Item value={u} label={u} class="text-xs">{u}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full bg-white text-[10px] font-bold text-black"
									onclick={() =>
										save({ total_storage_limit_gb: (editVal * B_VALS[editUnit]) / B_VALS.GB })}
									>SAVE</Button
								>
							</div>
						{:else}
							{@const f = formatBytes(configData.total_storage_limit_gb * B_VALS.GB)}
							<div class="flex items-baseline gap-2">
								<span class="text-5xl font-black text-white">{f.val}</span>
								<span class="text-xs font-bold text-emerald-500 uppercase">{f.unit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none">
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<FileCode class="size-4 text-blue-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>File Ceiling</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8 border-zinc-800 bg-zinc-900 hover:bg-blue-500"
							onclick={() => startEdit('file')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'file'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input type="number" bind:value={editVal} class="h-8 border-zinc-800 bg-black" />
									<Select.Root type="single" bind:value={editUnit as string}>
										<Select.Trigger
											class="h-8 w-22 border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
											{#each Object.keys(B_VALS) as u}
												<Select.Item value={u} label={u} class="text-xs">{u}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full bg-white text-[10px] font-bold text-black"
									onclick={() =>
										save({ max_file_size_mb: (editVal * B_VALS[editUnit]) / B_VALS.MB })}
									>SAVE</Button
								>
							</div>
						{:else}
							{@const f = formatBytes(configData.max_file_size_mb * B_VALS.MB)}
							<div class="flex items-baseline gap-2">
								<span class="text-5xl font-black text-white">{f.val}</span>
								<span class="text-xs font-bold text-blue-500 uppercase">{f.unit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none">
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<Download class="size-4 text-violet-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Download Presets</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8 border-zinc-800 bg-zinc-900"
							onclick={() => (editing = editing === 'steps' ? null : 'steps')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center space-y-3">
						{#if editing === 'steps'}
							<div in:slide class="mb-2 flex gap-1">
								<Input
									type="number"
									bind:value={tempInput.dl}
									class="h-7 border-zinc-800 bg-black text-xs"
								/>
								<Button
									size="sm"
									class="h-7 bg-zinc-800 text-[9px] font-bold"
									onclick={() => {
										if (tempInput.dl && configData)
											save({
												download_configs: [...configData.download_configs, tempInput.dl].sort(
													(a, b) => a - b
												)
											});
										tempInput.dl = 0;
									}}>ADD</Button
								>
							</div>
						{/if}
						<div class="flex flex-wrap gap-1">
							{#each configData.download_configs as dl}
								<Badge class="border-zinc-800 bg-zinc-900 text-[10px] text-violet-400">
									{dl}x
									{#if editing === 'steps'}
										<button
											onclick={() => {
												if (configData)
													save({
														download_configs: configData.download_configs.filter(
															(v: number) => v !== dl
														)
													});
											}}
											class="ml-1 hover:text-white"
										>
											<X class="size-2.5" />
										</button>
									{/if}
								</Badge>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none lg:col-span-2">
					<Card.Header class="pb-2">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
							>Retention Defaults</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid min-h-24 grid-cols-2 gap-8">
						<div class="flex flex-col justify-center">
							<Label class="mb-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase"
								>Default Expiry</Label
							>
							<Select.Root
								type="single"
								value={selectedExpiry}
								onValueChange={(v) => save({ default_expiry: Number(v) })}
							>
								<Select.Trigger class="h-10 border-zinc-800 bg-black font-mono text-xl text-white">
									{formatSeconds(configData.default_expiry).val}
									{formatSeconds(configData.default_expiry).unit}
								</Select.Trigger>
								<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
									{#each configData.time_configs as time}
										{@const f = formatSeconds(Number(time))}
										<Select.Item value={String(time)} label="{f.val} {f.unit}" class="text-xs"
											>{f.val} {f.unit}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex flex-col justify-center border-l border-zinc-900 pl-8">
							<Label class="mb-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase"
								>Default Downloads</Label
							>
							<Select.Root
								type="single"
								value={selectedDownloads}
								onValueChange={(v) => save({ default_number_of_downloads: Number(v) })}
							>
								<Select.Trigger class="h-10 border-zinc-800 bg-black font-mono text-xl text-white"
									>{configData.default_number_of_downloads}x</Select.Trigger
								>
								<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
									{#each configData.download_configs as dl}
										<Select.Item value={String(dl)} label="{dl}x" class="text-xs">{dl}x</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="overflow-hidden border-zinc-900 bg-zinc-950 shadow-none lg:col-span-3">
					<Card.Header
						class="flex flex-row items-center justify-between border-b border-zinc-900 bg-zinc-900/10 px-6 pb-4"
					>
						<div class="flex items-center gap-2">
							<Globe class="size-4 text-sky-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Site Description</Card.Title
							>
						</div>
						<div class="flex gap-2">
							{#if editing === 'desc'}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										if (configData) save({ site_description: configData.site_description });
									}}
									class="h-7 border-emerald-900 text-[10px] text-emerald-500">SAVE</Button
								>
							{/if}
							<Button
								variant="outline"
								size="sm"
								onclick={() => (editing = editing === 'desc' ? null : 'desc')}
								class="h-7 text-[10px]"
							>
								<Pencil class="mr-1.5 size-3" />
								{editing === 'desc' ? 'HIDE' : 'EDIT'}
							</Button>
						</div>
					</Card.Header>
					<Card.Content class="p-0">
						{#if editing === 'desc'}
							<div in:slide class="grid divide-x divide-zinc-900 md:grid-cols-2">
								<textarea
									bind:value={configData.site_description}
									class="min-h-75 resize-none bg-black p-6 font-mono text-sm text-zinc-400 outline-none"
								></textarea>
								<div class="prose prose-invert prose-sm max-w-none p-6">{@html previewHtml}</div>
							</div>
						{:else}
							<div in:fade class="prose prose-invert prose-sm max-w-none p-8">
								{@html previewHtml}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>
</div>
