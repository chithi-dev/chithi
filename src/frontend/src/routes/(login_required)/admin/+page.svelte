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
		Clock,
		Download,
		ShieldAlert,
		ShieldCheck,
		Globe,
		Pencil,
		X,
		Settings2
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { marked } from 'marked';

	// --- CONVERSION LOGIC ---
	type ByteUnit = 'Bytes' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB';
	const B_VALS: Record<ByteUnit, number> = {
		Bytes: 1,
		KB: 1024,
		MB: 1024 ** 2,
		GB: 1024 ** 3,
		TB: 1024 ** 4,
		PB: 1024 ** 5
	};

	type TimeUnit = 'Seconds' | 'Minutes' | 'Hours' | 'Days' | 'Weeks' | 'Months';
	const T_UNITS: TimeUnit[] = ['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Months'];
	const T_VALS: Record<TimeUnit, number> = {
		Seconds: 1,
		Minutes: 60,
		Hours: 3600,
		Days: 86400,
		Weeks: 604800,
		Months: 2592000
	};

	// --- STATE ---
	let config = $state({
		total_storage_limit: 10737418240,
		max_file_size_limit: 104857600,
		default_expiry: 604800,
		default_number_of_downloads: 5,
		site_description: '# Welcome to Chithi',
		download_configs: [1, 5, 10, 50],
		time_configs: [3600, 86400, 604800],
		allowed_file_types: ['png', 'jpg'],
		banned_file_types: ['exe']
	});

	// Helpers for the Select bindings (fixes the type error)
	let selectedExpiry = $derived(String(config.default_expiry));
	let selectedDownloads = $derived(String(config.default_number_of_downloads));

	// --- UI HELPERS ---
	let editing = $state<string | null>(null);
	let editVal = $state(0);
	let editUnit = $state<string>('');
	let tempInput = $state({ ext: '', ban: '', dl: 0, timeVal: 0, timeUnit: 'Hours' as TimeUnit });

	function formatBytes(bytes: number) {
		const i = bytes <= 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
		return {
			val: parseFloat((bytes / Math.pow(1024, i)).toFixed(2)),
			unit: ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'][i]
		};
	}

	function formatSeconds(seconds: number): { val: number; unit: TimeUnit } {
		for (const unit of [...T_UNITS].reverse()) {
			if (seconds % T_VALS[unit] === 0) return { val: seconds / T_VALS[unit], unit };
		}
		return { val: seconds, unit: 'Seconds' };
	}

	function startEdit(type: 'storage' | 'file') {
		const f =
			type === 'file'
				? formatBytes(config.max_file_size_limit)
				: formatBytes(config.total_storage_limit);
		editVal = f.val;
		editUnit = f.unit;
		editing = type;
	}

	const previewHtml = $derived(marked.parse(config.site_description));
</script>

<div class="min-h-screen bg-[#050505] p-8 text-zinc-300">
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex items-center gap-4 border-b border-zinc-900 pb-8">
			<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
				<Settings2 class="size-6 text-white" />
			</div>
			<h1 class="text-3xl font-black tracking-tight text-white uppercase italic">
				Chithi <span class="font-light text-zinc-600 not-italic">Engine</span>
			</h1>
		</header>

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
						class="size-8 border-zinc-800 bg-zinc-900 transition-colors hover:bg-emerald-500"
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
								<Select.Root type="single" bind:value={editUnit}>
									<Select.Trigger
										class="h-8 w-22.5 border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
										>{editUnit}</Select.Trigger
									>
									<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
										{#each ['Bytes', 'KB', 'MB', 'GB', 'TB'] as u}
											<Select.Item value={u} label={u} class="text-xs">{u}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Button
								size="sm"
								class="h-7 w-full bg-white text-[10px] font-bold text-black"
								onclick={() => {
									config.total_storage_limit = editVal * B_VALS[editUnit as ByteUnit];
									editing = null;
								}}>SAVE</Button
							>
						</div>
					{:else}
						{@const f = formatBytes(config.total_storage_limit)}
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
						class="size-8 border-zinc-800 bg-zinc-900 transition-colors hover:bg-blue-500"
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
								<Select.Root type="single" bind:value={editUnit}>
									<Select.Trigger
										class="h-8 w-22.5 border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
										>{editUnit}</Select.Trigger
									>
									<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
										{#each ['Bytes', 'KB', 'MB', 'GB'] as u}
											<Select.Item value={u} label={u} class="text-xs">{u}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Button
								size="sm"
								class="h-7 w-full bg-white text-[10px] font-bold text-black"
								onclick={() => {
									config.max_file_size_limit = editVal * B_VALS[editUnit as ByteUnit];
									editing = null;
								}}>SAVE</Button
							>
						</div>
					{:else}
						{@const f = formatBytes(config.max_file_size_limit)}
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
						class="size-8 border-zinc-800 bg-zinc-900 transition-colors hover:border-violet-500"
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
								placeholder="x"
								class="h-7 border-zinc-800 bg-black text-xs"
							/>
							<Button
								size="sm"
								class="h-7 bg-zinc-800 text-[9px] font-bold"
								onclick={() => {
									if (tempInput.dl && !config.download_configs.includes(tempInput.dl)) {
										config.download_configs = [...config.download_configs, tempInput.dl].sort(
											(a, b) => a - b
										);
									}
									tempInput.dl = 0;
								}}>ADD</Button
							>
						</div>
					{/if}
					<div class="flex flex-wrap gap-1">
						{#each config.download_configs as dl}
							<Badge class="border-zinc-800 bg-zinc-900 text-[10px] text-violet-400">
								{dl}x
								{#if editing === 'steps' && config.download_configs.length > 1}
									<button
										onclick={() => {
											config.download_configs = config.download_configs.filter((v) => v !== dl);
											if (config.default_number_of_downloads === dl)
												config.default_number_of_downloads = config.download_configs[0];
										}}
										class="ml-1 hover:text-white"><X class="size-2.5" /></button
									>
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
							onValueChange={(v) => (config.default_expiry = Number(v))}
						>
							<Select.Trigger class="h-10 border-zinc-800 bg-black font-mono text-xl text-white">
								{formatSeconds(config.default_expiry).val}
								{formatSeconds(config.default_expiry).unit}
							</Select.Trigger>
							<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
								{#each config.time_configs as time}
									{@const f = formatSeconds(time)}
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
							onValueChange={(v) => (config.default_number_of_downloads = Number(v))}
						>
							<Select.Trigger class="h-10 border-zinc-800 bg-black font-mono text-xl text-white">
								{config.default_number_of_downloads}x
							</Select.Trigger>
							<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
								{#each config.download_configs as dl}
									<Select.Item value={String(dl)} label="{dl}x" class="text-xs">{dl}x</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-4">
					<div class="flex items-center gap-2">
						<Clock class="size-4 text-rose-500" />
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
							>Expiry Presets</Card.Title
						>
					</div>
					<Button
						variant="outline"
						size="icon"
						class="size-8 border-zinc-800 bg-zinc-900 transition-colors hover:border-rose-500"
						onclick={() => (editing = editing === 'presets' ? null : 'presets')}
					>
						<Pencil class="size-3.5" />
					</Button>
				</Card.Header>
				<Card.Content class="flex min-h-24 flex-col justify-center space-y-3">
					{#if editing === 'presets'}
						<div in:slide class="mb-2 flex gap-1">
							<Input
								type="number"
								bind:value={tempInput.timeVal}
								class="h-7 w-16 border-zinc-800 bg-black text-xs"
							/>
							<Select.Root type="single" bind:value={tempInput.timeUnit}>
								<Select.Trigger
									class="h-7 border-zinc-800 bg-zinc-900 text-[10px] font-bold uppercase"
									>{tempInput.timeUnit}</Select.Trigger
								>
								<Select.Content class="border-zinc-800 bg-zinc-900 text-white">
									{#each T_UNITS as u}
										<Select.Item value={u} label={u} class="text-[10px] font-bold">{u}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<Button
								size="sm"
								class="h-7 bg-zinc-800 text-[9px] font-bold"
								onclick={() => {
									if (tempInput.timeVal) {
										const newSec = tempInput.timeVal * T_VALS[tempInput.timeUnit];
										if (!config.time_configs.includes(newSec))
											config.time_configs = [...config.time_configs, newSec].sort((a, b) => a - b);
									}
								}}>ADD</Button
							>
						</div>
					{/if}
					<div class="flex flex-wrap gap-1">
						{#each config.time_configs as sec}
							{@const f = formatSeconds(sec)}
							<Badge class="border-rose-500/20 bg-rose-500/10 text-[10px] text-rose-500">
								{f.val}{f.unit.slice(0, 1)}
								{#if editing === 'presets' && config.time_configs.length > 1}
									<button
										onclick={() => {
											config.time_configs = config.time_configs.filter((v) => v !== sec);
											if (config.default_expiry === sec)
												config.default_expiry = config.time_configs[0];
										}}
										class="ml-1 hover:text-white"><X class="size-2.5" /></button
									>
								{/if}
							</Badge>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none lg:col-span-3">
				<Card.Content class="grid gap-12 py-6 md:grid-cols-2">
					<div class="space-y-4">
						<div class="flex items-center gap-2">
							<ShieldCheck class="size-4 text-emerald-500" />
							<Label class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Allowed Extensions</Label
							>
						</div>
						<div class="flex gap-1">
							<Input
								bind:value={tempInput.ext}
								placeholder="ext"
								class="h-8 border-zinc-800 bg-black"
							/>
							<Button
								size="sm"
								class="h-8 bg-emerald-600 text-[10px] font-bold"
								onclick={() => {
									if (tempInput.ext)
										config.allowed_file_types = [...config.allowed_file_types, tempInput.ext];
									tempInput.ext = '';
								}}>ADD</Button
							>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each config.allowed_file_types as ext}
								<Badge
									variant="outline"
									class="border-emerald-500/20 font-mono text-[10px] text-emerald-500">{ext}</Badge
								>
							{/each}
						</div>
					</div>
					<div class="space-y-4">
						<div class="flex items-center gap-2">
							<ShieldAlert class="size-4 text-red-500" />
							<Label class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Banned Extensions</Label
							>
						</div>
						<div class="flex gap-1">
							<Input
								bind:value={tempInput.ban}
								placeholder="ext"
								class="h-8 border-zinc-800 bg-black"
							/>
							<Button
								size="sm"
								class="h-8 bg-red-600 text-[10px] font-bold"
								onclick={() => {
									if (tempInput.ban)
										config.banned_file_types = [...config.banned_file_types, tempInput.ban];
									tempInput.ban = '';
								}}>BAN</Button
							>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each config.banned_file_types as ext}
								<Badge
									variant="outline"
									class="border-red-500/20 font-mono text-[10px] text-red-400">{ext}</Badge
								>
							{/each}
						</div>
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
					<Button
						variant="outline"
						size="sm"
						onclick={() => (editing = editing === 'desc' ? null : 'desc')}
						class="h-7 cursor-pointer border-zinc-800 text-[10px] font-bold"
					>
						<Pencil class="mr-1.5 size-3" />
						{editing === 'desc' ? 'HIDE' : 'EDIT'}
					</Button>
				</Card.Header>
				<Card.Content class="p-0">
					{#if editing === 'desc'}
						<div in:slide class="grid divide-x divide-zinc-900 md:grid-cols-2">
							<textarea
								bind:value={config.site_description}
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
	</div>
</div>
