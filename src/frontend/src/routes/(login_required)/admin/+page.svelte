<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select';
	import {
		HardDrive,
		FileCode,
		Clock,
		Download,
		ShieldAlert,
		ShieldCheck,
		Globe,
		Check,
		Loader2,
		Pencil,
		X,
		Bold,
		Italic,
		Calendar
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { marked } from 'marked';

	// Types & Constants
	type ByteUnit = 'Bytes' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB';
	const UNITS: ByteUnit[] = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const UNIT_VALS: Record<ByteUnit, number> = {
		Bytes: 1,
		KB: 1024,
		MB: 1024 ** 2,
		GB: 1024 ** 3,
		TB: 1024 ** 4,
		PB: 1024 ** 5
	};

	// State mirroring your SQLModel
	let config = $state({
		total_storage_limit: 10737418240,
		max_file_size_limit: 104857600,
		default_expiery: 604800,
		default_number_of_downloads: 5,
		site_description: '# Welcome to Chithi',
		download_configs: [1, 5, 10],
		time_configs: [] as string[],
		allowed_file_types: ['png', 'pdf'],
		banned_file_types: ['exe', 'bat']
	});

	// UI Logic
	let editing = $state<string | null>(null);
	let loadingField = $state<string | null>(null);
	let editVal = $state(0);
	let editUnit = $state<ByteUnit>('GB');
	let tempInput = $state({ ext: '', ban: '', dl: 0, date: '' });

	function formatBytes(bytes: number): { val: number; unit: ByteUnit } {
		if (bytes <= 0) return { val: 0, unit: 'Bytes' };
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return { val: parseFloat((bytes / Math.pow(1024, i)).toFixed(2)), unit: UNITS[i] };
	}

	async function sync(field: string, action?: () => void) {
		loadingField = field;
		if (action) action();
		await new Promise((r) => setTimeout(r, 400));
		editing = null;
		loadingField = null;
	}

	const previewHtml = $derived(marked.parse(config.site_description));
</script>

<div class="min-h-screen bg-[#0a0a0a] p-8 text-white selection:bg-emerald-500/30">
	<div class="mx-auto max-w-6xl space-y-8">
		<header class="flex items-end justify-between border-b border-zinc-800 pb-6">
			<div>
				<h1 class="text-3xl font-black tracking-tighter text-white italic">
					CHITHI <span class="font-light text-zinc-500 not-italic">/ CONFIG</span>
				</h1>
				<p class="mt-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
					Instance Engine Parameters
				</p>
			</div>
		</header>

		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>Total Storage</Card.Title
					>
					<HardDrive class="size-4 text-emerald-400" />
				</Card.Header>
				<Card.Content class="min-h-[100px]">
					{#if editing === 'storage'}
						<div in:fade class="space-y-2">
							<div class="flex gap-1">
								<Input
									type="number"
									bind:value={editVal}
									class="h-8 border-zinc-800 bg-black text-xs"
								/>
								<Select.Root type="single" bind:value={editUnit}>
									<Select.Trigger
										class="h-8 w-[80px] border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
										>{editUnit}</Select.Trigger
									>
									<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
										{#each UNITS.slice(2) as u}<Select.Item
												value={u}
												label={u}
												class="text-[10px] uppercase">{u}</Select.Item
											>{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Button
								size="sm"
								class="h-8 w-full bg-white font-bold text-black"
								onclick={() =>
									sync(
										'storage',
										() => (config.total_storage_limit = editVal * UNIT_VALS[editUnit])
									)}
							>
								{loadingField === 'storage' ? '...' : 'Save Bytes'}
							</Button>
						</div>
					{:else}
						<div class="flex items-baseline gap-2">
							<span class="text-4xl font-black">{formatBytes(config.total_storage_limit).val}</span>
							<span class="text-xs font-bold text-emerald-400"
								>{formatBytes(config.total_storage_limit).unit}</span
							>
						</div>
						<button
							onclick={() => {
								editVal = formatBytes(config.total_storage_limit).val;
								editUnit = formatBytes(config.total_storage_limit).unit;
								editing = 'storage';
							}}
							class="mt-1 cursor-pointer font-mono text-[9px] text-zinc-600 italic underline hover:text-zinc-400"
							>Edit Payload</button
						>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>Max File Limit</Card.Title
					>
					<FileCode class="size-4 text-blue-400" />
				</Card.Header>
				<Card.Content class="min-h-[100px]">
					{#if editing === 'file'}
						<div in:fade class="space-y-2">
							<div class="flex gap-1">
								<Input
									type="number"
									bind:value={editVal}
									class="h-8 border-zinc-800 bg-black text-xs"
								/>
								<Select.Root type="single" bind:value={editUnit}>
									<Select.Trigger
										class="h-8 w-[80px] border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
										>{editUnit}</Select.Trigger
									>
									<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
										{#each UNITS.slice(1, 4) as u}<Select.Item
												value={u}
												label={u}
												class="text-[10px] uppercase">{u}</Select.Item
											>{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Button
								size="sm"
								class="h-8 w-full bg-white font-bold text-black"
								onclick={() =>
									sync('file', () => (config.max_file_size_limit = editVal * UNIT_VALS[editUnit]))}
								>Save</Button
							>
						</div>
					{:else}
						<div class="flex items-baseline gap-2">
							<span class="text-4xl font-black">{formatBytes(config.max_file_size_limit).val}</span>
							<span class="text-xs font-bold text-blue-400"
								>{formatBytes(config.max_file_size_limit).unit}</span
							>
						</div>
						<button
							onclick={() => {
								editVal = formatBytes(config.max_file_size_limit).val;
								editUnit = formatBytes(config.max_file_size_limit).unit;
								editing = 'file';
							}}
							class="mt-1 cursor-pointer font-mono text-[9px] text-zinc-600 italic underline hover:text-zinc-400"
							>Edit Size</button
						>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>Download Steps</Card.Title
					>
					<Download class="size-4 text-violet-400" />
				</Card.Header>
				<Card.Content class="min-h-[100px] space-y-3">
					<div class="flex flex-wrap gap-1">
						{#each config.download_configs as dl}
							<Badge
								variant="secondary"
								class="border-zinc-800 bg-zinc-900 pr-1 text-[10px] text-violet-300"
							>
								{dl}x
								<button
									onclick={() =>
										(config.download_configs = config.download_configs.filter((i) => i !== dl))}
									class="ml-1 cursor-pointer hover:text-white"><X class="size-3" /></button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-1">
						<Input
							type="number"
							bind:value={tempInput.dl}
							placeholder="+"
							class="h-7 border-zinc-800 bg-black text-xs"
						/>
						<Button
							size="sm"
							variant="outline"
							class="h-7 cursor-pointer border-zinc-800 text-[10px] font-bold"
							onclick={() => {
								if (!config.download_configs.includes(tempInput.dl))
									config.download_configs = [...config.download_configs, tempInput.dl].sort(
										(a, b) => a - b
									);
							}}>ADD</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none lg:col-span-2">
				<Card.Header>
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>Retention Defaults</Card.Title
					>
				</Card.Header>
				<Card.Content class="grid grid-cols-2 gap-8">
					<div class="space-y-2">
						<label class="text-[10px] font-bold text-zinc-500 uppercase"
							>Default Expiry (Seconds)</label
						>
						<Input
							type="number"
							bind:value={config.default_expiery}
							class="border-zinc-800 bg-black"
						/>
						<p class="text-[10px] text-amber-500 italic">
							≈ {Math.floor(config.default_expiery / 86400)} Days
						</p>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-bold text-zinc-500 uppercase">Default Download Cap</label
						>
						<Input
							type="number"
							bind:value={config.default_number_of_downloads}
							class="border-zinc-800 bg-black"
						/>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>Available Dates</Card.Title
					>
					<Calendar class="size-4 text-rose-400" />
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex flex-wrap gap-1">
						{#each config.time_configs as date}
							<Badge class="border-rose-500/20 bg-rose-500/10 pr-1 text-[10px] text-rose-400">
								{date}
								<button
									onclick={() =>
										(config.time_configs = config.time_configs.filter((d) => d !== date))}
									class="ml-1 cursor-pointer"><X class="size-3" /></button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-1">
						<Input
							type="date"
							bind:value={tempInput.date}
							class="h-8 border-zinc-800 bg-black text-xs invert"
						/>
						<Button
							size="sm"
							class="h-8 cursor-pointer bg-zinc-800 text-[10px] font-bold text-white"
							onclick={() => {
								if (tempInput.date && !config.time_configs.includes(tempInput.date))
									config.time_configs = [...config.time_configs, tempInput.date];
							}}>ADD</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-800 bg-zinc-950/50 shadow-none md:col-span-2 lg:col-span-3">
				<Card.Header class="flex flex-row items-center gap-4">
					<ShieldCheck class="size-4 text-emerald-400" />
					<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
						>File Type Policies</Card.Title
					>
					<ShieldAlert class="ml-auto size-4 text-red-400" />
				</Card.Header>
				<Card.Content class="grid gap-8 md:grid-cols-2">
					<div class="space-y-4">
						<div class="flex gap-2">
							<Input
								bind:value={tempInput.ext}
								placeholder="ext (e.g. zip)"
								class="h-8 border-zinc-800 bg-black text-xs"
							/>
							<Button
								size="sm"
								class="h-8 cursor-pointer bg-emerald-600 text-[10px] font-bold"
								onclick={() => {
									if (tempInput.ext)
										config.allowed_file_types = [...config.allowed_file_types, tempInput.ext];
									tempInput.ext = '';
								}}>ALLOW</Button
							>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each config.allowed_file_types as ext}
								<Badge variant="outline" class="border-emerald-500/30 text-[10px] text-emerald-400"
									>.{ext}</Badge
								>
							{/each}
						</div>
					</div>
					<div class="space-y-4 text-right">
						<div class="flex justify-end gap-2">
							<Button
								size="sm"
								class="h-8 cursor-pointer bg-red-600 text-[10px] font-bold"
								onclick={() => {
									if (tempInput.ban)
										config.banned_file_types = [...config.banned_file_types, tempInput.ban];
									tempInput.ban = '';
								}}>BAN</Button
							>
							<Input
								bind:value={tempInput.ban}
								placeholder="ext (e.g. exe)"
								class="h-8 w-48 border-zinc-800 bg-black text-right text-xs"
							/>
						</div>
						<div class="flex flex-wrap justify-end gap-1">
							{#each config.banned_file_types as ext}
								<Badge variant="outline" class="border-red-500/30 text-[10px] text-red-400"
									>.{ext}</Badge
								>
							{/each}
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 shadow-none lg:col-span-3"
			>
				<Card.Header
					class="flex flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/10 pb-4"
				>
					<div class="flex items-center gap-3">
						<Globe class="size-4 text-sky-400" />
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Metadata & Narrative</Card.Title
						>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (editing = editing === 'desc' ? null : 'desc')}
						class="h-7 cursor-pointer text-[10px] font-bold"
					>
						{editing === 'desc' ? 'CLOSE EDITOR' : 'EDIT MARKDOWN'}
					</Button>
				</Card.Header>
				<Card.Content class="p-0">
					{#if editing === 'desc'}
						<div in:slide class="grid md:grid-cols-2">
							<textarea
								bind:value={config.site_description}
								class="min-h-[300px] border-r border-zinc-800 bg-black p-6 font-mono text-sm text-zinc-400 focus:outline-none"
							></textarea>
							<div
								class="prose prose-invert prose-sm prose-h1:text-sky-400 max-w-none bg-zinc-950/50 p-6"
							>
								{@html previewHtml}
							</div>
						</div>
					{:else}
						<div in:fade class="prose prose-invert prose-sm max-w-none p-8">
							{@html previewHtml}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
