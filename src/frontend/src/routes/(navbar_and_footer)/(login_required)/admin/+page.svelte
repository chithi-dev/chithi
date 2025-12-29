<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Select from '$lib/components/ui/select';
	import {
		HardDrive,
		FileCode,
		Download,
		Globe,
		Pencil,
		X,
		Settings2,
		LoaderCircle,
		Clock,
		Plus,
		FileCheck,
		FileWarning
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { marked } from 'marked';

	import { Sun, Moon } from 'lucide-svelte';

	import { useConfigQuery } from '$lib/queries/config';
	import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '$lib/functions/bytes';
	import { formatSeconds, secondsToNumber, T_UNITS, type TimeUnit } from '$lib/functions/times';
	import { sanitizeExt } from '$lib/functions/sanitize';

	// Query hook and helpers

	// Query hook
	const { config: configQuery, update_config } = useConfigQuery();

	// Derived state
	let configData = $derived(configQuery.data);
	let previewHtml = $derived(
		configData?.site_description ? marked.parse(configData.site_description) : ''
	);

	// UI state
	let editing = $state<
		'storage' | 'file' | 'steps' | 'desc' | 'time' | 'allowed' | 'banned' | null
	>(null);
	let editVal = $state(0);
	let editUnit = $state<ByteUnit>('GB');
	let tempInput = $state({
		dl: 0,
		time: 0,
		timeUnit: 'Hours' as TimeUnit,
		str: ''
	});

	// Helpers
	function startEdit(type: 'storage' | 'file') {
		if (!configData) return;
		const bytes =
			type === 'storage' ? configData.total_storage_limit : configData.max_file_size_limit;
		const f = formatBytes(bytes);
		editVal = f.val;
		editUnit = f.unit;
		editing = type;
	}

	async function save(payload: any) {
		try {
			const result = await update_config(payload);
			if (configData && result) {
				Object.assign(configData, payload);
			}
		} catch (error) {
			console.error('Save failed:', error);
		}
	}
</script>

<div class="bg-white p-8 text-zinc-900 dark:bg-[#050505] dark:text-zinc-300">
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex items-center justify-between border-b border-border p-4">
			<div class="flex items-center">
				<div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
					<Settings2 class="size-6" />
				</div>
				<h1 class="ml-3 text-2xl font-bold md:text-xl">Chithi Engine</h1>
			</div>

			<div class="flex items-center gap-3">
				{#if configQuery.isFetching}
					<div
						in:fade
						class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
					>
						<LoaderCircle class="size-3 animate-spin" /> Syncing
					</div>
				{/if}
			</div>
		</header>
		{#if configQuery.isLoading}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<div class="space-y-4 rounded-xl border border-zinc-900 bg-zinc-950/50 p-6">
						<div class="flex justify-between">
							<Skeleton class="h-4 w-24 bg-zinc-900" />
							<Skeleton class="h-8 w-8 bg-zinc-900" />
						</div>
						<Skeleton class="h-12 w-32 bg-zinc-900" />
					</div>
				{/each}
			</div>
		{:else if configData}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<Card.Root
					class="rounded-xl border border-zinc-200 bg-white/60 shadow-none dark:border-zinc-900 dark:bg-zinc-950/50"
				>
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<HardDrive class="size-4 text-violet-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Storage Pool</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8 border border-zinc-200 dark:border-zinc-800"
							onclick={() => startEdit('storage')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'storage'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input
										type="number"
										bind:value={editVal}
										class="h-8 border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
										min="0"
										step="0.01"
									/>
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger
											class="h-8 w-22 border-zinc-800 bg-zinc-900 text-[10px] uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content class="border-zinc-800 bg-zinc-900">
											{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}
													>{u}</Select.Item
												>{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full bg-white text-[10px] font-bold text-black hover:bg-zinc-200"
									onclick={() => {
										save({ total_storage_limit: bytesToNumber(editVal, editUnit) });
										editing = null;
									}}>SAVE</Button
								>
							</div>
						{:else}
							{@const f = formatBytes(configData.total_storage_limit)}
							<div class="flex items-baseline gap-2">
								<span class="text-5xl font-black">{f.val}</span>
								<span class="text-xs font-bold text-violet-500 uppercase">{f.unit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root
					class="rounded-xl border border-zinc-200 bg-white/60 shadow-none dark:border-zinc-900 dark:bg-zinc-950/50"
				>
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<FileCode class="size-4 text-indigo-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>File Ceiling</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8 border border-zinc-200 dark:border-zinc-800"
							onclick={() => startEdit('file')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'file'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input
										type="number"
										bind:value={editVal}
										class="h-8 border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
										min="0"
										step="0.01"
									/>
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger
											class="h-8 w-22 border-zinc-800 bg-zinc-900 text-[10px] uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content class="border-zinc-800 bg-zinc-900">
											{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}
													>{u}</Select.Item
												>{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full bg-white text-[10px] font-bold text-black hover:bg-zinc-200"
									onclick={() => {
										save({ max_file_size_limit: bytesToNumber(editVal, editUnit) });
										editing = null;
									}}>SAVE</Button
								>
							</div>
						{:else}
							{@const f = formatBytes(configData.max_file_size_limit)}
							<div class="flex items-baseline gap-2">
								<span class="text-5xl font-black">{f.val}</span>
								<span class="accent-blue text-xs font-bold uppercase">{f.unit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root
					class="rounded-xl border border-zinc-200 bg-white/60 shadow-none dark:border-zinc-900 dark:bg-zinc-950/50"
				>
					<Card.Header class="flex flex-row items-center justify-between pb-4">
						<div class="flex items-center gap-2">
							<Clock class="size-4 text-amber-500" />
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
								>Expiry Options</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="card-btn size-8 border"
							onclick={() => {
								editing = editing === 'time' ? null : 'time';
								if (editing === 'time') {
									tempInput.time = 1;
									tempInput.timeUnit = 'Hours';
								}
							}}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center space-y-3">
						{#if editing === 'time'}
							<div in:slide class="flex gap-1">
								<Input
									type="number"
									bind:value={tempInput.time}
									class="h-7 border border-zinc-200 bg-white text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
									min="1"
								/>
								<Select.Root type="single" bind:value={tempInput.timeUnit}>
									<Select.Trigger class="h-7 w-20 border-zinc-800 bg-zinc-900 text-[9px] uppercase"
										>{tempInput.timeUnit}</Select.Trigger
									>
									<Select.Content class="border-zinc-800 bg-zinc-900">
										{#each T_UNITS as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}
									</Select.Content>
								</Select.Root>
								<Button
									size="sm"
									class="h-7 bg-zinc-800 hover:bg-zinc-700"
									onclick={() => {
										const secs = secondsToNumber(tempInput.time, tempInput.timeUnit);
										const newTimeConfigs = [...configData.time_configs, secs].sort((a, b) => a - b);
										save({ time_configs: newTimeConfigs });
									}}><Plus class="size-3" /></Button
								>
							</div>
						{/if}
						<div class="flex flex-wrap gap-1">
							{#each configData.time_configs as t, i}
								{@const f = formatSeconds(t)}
								<Badge class="text-[10px] text-amber-500">
									{f.val}{f.unit.charAt(0)}
									{#if editing === 'time'}
										<button
											onclick={() =>
												save({
													time_configs: configData.time_configs.filter(
														(_: number, idx: number) => idx !== i
													)
												})}
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

				<Card.Root
					class="rounded-xl border border-zinc-200 bg-white/60 shadow-none lg:col-span-2 dark:border-zinc-900 dark:bg-zinc-950/50"
				>
					<Card.Header class="pb-2">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
							>Retention Defaults</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid min-h-24 grid-cols-2 gap-8">
						<div class="flex flex-col justify-center">
							<Label class="mb-2 text-[9px] font-bold text-zinc-600 uppercase">Default Expiry</Label
							>
							<Select.Root
								type="single"
								value={String(configData.default_expiry)}
								onValueChange={(v) => save({ default_expiry: Number(v) })}
							>
								<Select.Trigger
									class="h-10 border border-zinc-200 bg-white font-mono text-xl text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
								>
									{formatSeconds(configData.default_expiry).val}
									{formatSeconds(configData.default_expiry).unit}
								</Select.Trigger>
								<Select.Content
									class="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
								>
									{#each configData.time_configs as t}
										{@const f = formatSeconds(t)}
										<Select.Item value={String(t)} label="{f.val} {f.unit}"
											>{f.val} {f.unit}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex flex-col justify-center border-l border-zinc-900 pl-8">
							<Label class="mb-2 text-[9px] font-bold text-zinc-600 uppercase"
								>Default Downloads</Label
							>
							<Select.Root
								type="single"
								value={String(configData.default_number_of_downloads)}
								onValueChange={(v) => save({ default_number_of_downloads: Number(v) })}
							>
								<Select.Trigger
									class="h-10 border border-zinc-200 bg-white font-mono text-xl text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
									>{configData.default_number_of_downloads}x</Select.Trigger
								>
								<Select.Content class="border-zinc-800 bg-zinc-900">
									{#each configData.download_configs as dl}
										<Select.Item value={String(dl)} label="{dl}x">{dl}x</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root
					class="rounded-xl border border-zinc-200 bg-white/60 shadow-none dark:border-zinc-900 dark:bg-zinc-950/50"
				>
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
							class="size-8 border-zinc-800 bg-zinc-900 hover:bg-violet-500"
							onclick={() => {
								editing = editing === 'steps' ? null : 'steps';
								if (editing === 'steps') tempInput.dl = 1;
							}}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center space-y-3">
						{#if editing === 'steps'}
							<div in:slide class="flex gap-1">
								<Input
									type="number"
									bind:value={tempInput.dl}
									class="h-7 border-zinc-800 bg-black text-xs"
									min="1"
								/>
								<Button
									size="sm"
									class="h-7 bg-zinc-800 hover:bg-zinc-700"
									onclick={() => {
										const newList = [...configData.download_configs, tempInput.dl].sort(
											(a, b) => a - b
										);
										save({ download_configs: newList });
									}}>ADD</Button
								>
							</div>
						{/if}
						<div class="flex flex-wrap gap-1">
							{#each configData.download_configs as dl, i}
								<Badge class="text-[10px] text-violet-500">
									{dl}x
									{#if editing === 'steps'}
										<button
											onclick={() =>
												save({
													download_configs: configData.download_configs.filter(
														(_: number, idx: number) => idx !== i
													)
												})}
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

				<Card.Root class="border-zinc-900 bg-zinc-950/50 shadow-none lg:col-span-3">
					<Card.Header class="pb-2">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase"
							>File Type Restrictions</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid gap-8 md:grid-cols-2">
						<div class="space-y-3">
							<div class="flex items-center justify-between border-b border-zinc-900 pb-2">
								<div class="flex items-center gap-2">
									<FileCheck class="size-4 text-violet-500" />
									<Label class="text-[9px] font-bold text-zinc-600 uppercase"
										>Allowed Extensions</Label
									>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 w-6 p-0 text-zinc-500 hover:text-emerald-500"
									onclick={() => {
										editing = editing === 'allowed' ? null : 'allowed';
										tempInput.str = '';
									}}
								>
									{#if editing === 'allowed'}<X class="size-3.5" />{:else}<Plus
											class="size-3.5"
										/>{/if}
								</Button>
							</div>
							{#if editing === 'allowed'}
								<div in:slide class="flex gap-1">
									<Input
										placeholder="e.g. pdf, png"
										bind:value={tempInput.str}
										class="h-7 border-zinc-800 bg-black text-xs"
										onkeydown={(e: KeyboardEvent) => {
											if (e.key === 'Enter') {
												const ext = sanitizeExt(tempInput.str);
												if (ext)
													save({
														allowed_file_types: [
															...new Set([...(configData.allowed_file_types || []), ext])
														]
													});
												tempInput.str = '';
											}
										}}
									/>
								</div>
							{/if}
							<div class="flex flex-wrap gap-1.5">
								{#if !configData.allowed_file_types?.length}
									<span class="text-xs text-zinc-700 italic">All files allowed</span>
								{:else}
									{#each configData.allowed_file_types as type}
										<Badge
											variant="outline"
											class="flex gap-1 border-zinc-800 bg-emerald-950/10 text-[10px] text-emerald-500"
										>
											{type}
											{#if editing === 'allowed'}
												<button
													onclick={() =>
														save({
															allowed_file_types: configData.allowed_file_types.filter(
																(t: string) => t !== type
															)
														})}><X class="size-2.5" /></button
												>
											{/if}
										</Badge>
									{/each}
								{/if}
							</div>
						</div>
						<div class="space-y-3 md:border-l md:border-zinc-900 md:pl-8">
							<div class="flex items-center justify-between border-b border-zinc-900 pb-2">
								<div class="flex items-center gap-2">
									<FileWarning class="size-4 text-red-500" />
									<Label class="text-[9px] font-bold text-zinc-600 uppercase"
										>Banned Extensions</Label
									>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 w-6 p-0 text-zinc-500 hover:text-red-500"
									onclick={() => {
										editing = editing === 'banned' ? null : 'banned';
										tempInput.str = '';
									}}
								>
									{#if editing === 'banned'}<X class="size-3.5" />{:else}<Plus
											class="size-3.5"
										/>{/if}
								</Button>
							</div>
							{#if editing === 'banned'}
								<div in:slide class="flex gap-1">
									<Input
										placeholder="e.g. exe, bat"
										bind:value={tempInput.str}
										class="h-7 border-zinc-800 bg-black text-xs"
										onkeydown={(e: KeyboardEvent) => {
											if (e.key === 'Enter') {
												const ext = sanitizeExt(tempInput.str);
												if (ext)
													save({
														banned_file_types: [
															...new Set([...(configData.banned_file_types || []), ext])
														]
													});
												tempInput.str = '';
											}
										}}
									/>
								</div>
							{/if}
							<div class="flex flex-wrap gap-1.5">
								{#if !configData.banned_file_types?.length}
									<span class="text-xs text-zinc-700 italic">No types banned</span>
								{:else}
									{#each configData.banned_file_types as type}
										<Badge
											variant="outline"
											class="flex gap-1 border-zinc-800 bg-red-950/10 text-[10px] text-red-500"
										>
											{type}
											{#if editing === 'banned'}
												<button
													onclick={() =>
														save({
															banned_file_types: configData.banned_file_types.filter(
																(t: string) => t !== type
															)
														})}><X class="size-2.5" /></button
												>
											{/if}
										</Badge>
									{/each}
								{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="card-root overflow-hidden shadow-none lg:col-span-3">
					<Card.Header
						class="card-header flex flex-row items-center justify-between border-b px-6 pb-4"
					>
						<div class="flex items-center gap-2">
							<Globe class="accent-blue size-4" />
							<Card.Title class="muted text-[10px] font-bold tracking-widest uppercase"
								>Site Description</Card.Title
							>
						</div>
						<div class="flex gap-2">
							{#if editing === 'desc'}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										save({ site_description: configData.site_description });
										editing = null;
									}}
									class="h-7 border-violet-500 text-[10px] text-violet-500 uppercase hover:bg-violet-500/10"
									>Save Changes</Button
								>
							{/if}
							<Button
								variant="outline"
								size="sm"
								onclick={() => (editing = editing === 'desc' ? null : 'desc')}
								class="h-7 text-[10px] uppercase hover:bg-zinc-800"
							>
								{editing === 'desc' ? 'Close Preview' : 'Edit Markdown'}
							</Button>
						</div>
					</Card.Header>
					<Card.Content class="p-0">
						{#if editing === 'desc'}
							<div in:slide class="grid divide-x divide-zinc-900 md:grid-cols-2">
								<textarea
									bind:value={configData.site_description}
									class="min-h-75 resize-none bg-white p-6 font-mono text-sm text-zinc-900 outline-none dark:bg-black dark:text-zinc-400"
									rows="10"
								></textarea>
								<div class="prose prose-sm dark:prose-invert max-w-none p-6">
									{@html previewHtml}
								</div>
							</div>
						{:else}
							<div in:fade class="prose prose-sm dark:prose-invert max-w-none p-8">
								{@html previewHtml}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</div>
</div>
