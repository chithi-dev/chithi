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
		FileExclamationPoint
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';

	import { useConfigQuery } from '$lib/queries/config';
	import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '$lib/functions/bytes';
	import { formatSeconds, secondsToNumber, T_UNITS, type TimeUnit } from '$lib/functions/times';
	import { sanitizeExt } from '$lib/functions/sanitize';
	import { marked } from '$lib/functions/marked';

	// Query hook
	const { config: configQuery, update_config } = useConfigQuery();

	// Derived state
	let configData = $derived(configQuery.data);
	let descDraft = $state('');
	let previewHtml = $derived(
		descDraft ? String(marked.parse(descDraft)) : marked.parse(configData?.site_description ?? '')
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

	// Preset limits
	const LIMITS = Object.freeze({
		download_preset: 5,
		time_preset: 5,
		site_description: {
			words: 150,
			paragraph: 3,
			chars: 1000
		}
	});

	// Site description metrics (derived)
	let descWordCount = $derived(
		descDraft ? descDraft.trim().split(/\s+/).filter(Boolean).length : 0
	);
	let descCharCount = $derived(descDraft ? String(descDraft).length : 0);
	let descParagraphCount = $derived(
		descDraft ? descDraft.split(/\n{2,}/).filter((p) => p.trim().length).length : 0
	);
	let descExceeds = $derived(
		descWordCount > LIMITS.site_description.words ||
			descCharCount > LIMITS.site_description.chars ||
			descParagraphCount > LIMITS.site_description.paragraph
	);

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
			await update_config(payload);
		} catch (error) {
			console.error('Save failed:', error);
		}
	}
</script>

<div class="flex min-h-screen w-full flex-col">
	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
		<header class="flex items-center justify-between border-b border-border pb-4">
			<div class="flex items-center">
				<div class="rounded-xl border bg-background p-3 shadow-sm">
					<Settings2 class="size-6" />
				</div>
				<h1 class="ml-3 text-2xl font-bold md:text-xl">Chithi Admin Panel</h1>
			</div>

			<div class="flex items-center gap-3">
				{#if configQuery.isFetching}
					<div
						in:fade
						class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
					>
						<LoaderCircle class="size-3 animate-spin" /> Syncing
					</div>
				{/if}
			</div>
		</header>
		{#if configQuery.isLoading}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<div class="space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
						<div class="flex justify-between">
							<Skeleton class="h-4 w-24 bg-muted" />
							<Skeleton class="h-8 w-8 bg-muted" />
						</div>
						<Skeleton class="h-12 w-32 bg-muted" />
					</div>
				{/each}
			</div>
		{:else if configData}
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<div class="flex items-center gap-2">
							<HardDrive class="size-4 text-violet-500" />
							<Card.Title
								class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
								>Storage Pool</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							onclick={() => startEdit('storage')}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'storage'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input type="number" bind:value={editVal} class="h-8" min="0" step="0.01" />
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger class="h-8 w-22 text-[10px] uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content>
											{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}
													>{u}</Select.Item
												>{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full text-[10px] font-bold"
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

				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<div class="flex items-center gap-2">
							<FileCode class="size-4 text-primary" />
							<Card.Title
								class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
								>File Ceiling</Card.Title
							>
						</div>
						<Button variant="outline" size="icon" class="size-8" onclick={() => startEdit('file')}>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="flex min-h-24 flex-col justify-center">
						{#if editing === 'file'}
							<div in:fade class="space-y-2">
								<div class="flex gap-1">
									<Input type="number" bind:value={editVal} class="h-8" min="0" step="0.01" />
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger class="h-8 w-22 text-[10px] uppercase"
											>{editUnit}</Select.Trigger
										>
										<Select.Content>
											{#each Object.keys(B_VALS) as u}<Select.Item value={u} label={u}
													>{u}</Select.Item
												>{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<Button
									size="sm"
									class="h-7 w-full text-[10px] font-bold"
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
								<span class="text-xs font-bold text-primary uppercase">{f.unit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<div class="flex items-center gap-2">
							<Clock class="size-4 text-primary" />
							<Card.Title
								class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
								>Expiry Options</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="card-btn size-8"
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
					{#if (configData?.time_configs?.length ?? 0) > LIMITS.time_preset || (editing === 'time' && (configData?.time_configs?.length ?? 0) + 1 > LIMITS.time_preset)}
						<div in:fade class="p-4 text-xs text-destructive italic">
							User experience may be hindered if you add more than {LIMITS.time_preset} time presets.
						</div>
					{/if}
					<Card.Content
						class={'flex min-h-24 flex-col justify-center space-y-3' +
							((configData?.time_configs?.length ?? 0) > LIMITS.time_preset ||
							(editing === 'time' &&
								(configData?.time_configs?.length ?? 0) + 1 > LIMITS.time_preset)
								? ' border border-destructive/50 bg-destructive/10'
								: '')}
					>
						{#if editing === 'time'}
							<div in:slide class="flex gap-1">
								<Input type="number" bind:value={tempInput.time} class="h-7 text-xs" min="1" />
								<Select.Root type="single" bind:value={tempInput.timeUnit}>
									<Select.Trigger class="h-7 w-20 text-[9px] uppercase"
										>{tempInput.timeUnit}</Select.Trigger
									>
									<Select.Content>
										{#each T_UNITS as u}<Select.Item value={u} label={u}>{u}</Select.Item>{/each}
									</Select.Content>
								</Select.Root>
								<Button
									size="sm"
									class="h-7"
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
								<Badge variant="secondary" class="text-[10px]">
									{f.val}{f.unit.charAt(0)}
									{#if editing === 'time'}
										<button
											onclick={() =>
												save({
													time_configs: configData.time_configs.filter(
														(_: number, idx: number) => idx !== i
													)
												})}
											class="ml-1 hover:text-foreground"
										>
											<X class="size-2.5" />
										</button>
									{/if}
								</Badge>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm lg:col-span-2">
					<Card.Header class="pb-2">
						<Card.Title
							class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
							>Retention Defaults</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid min-h-24 grid-cols-2 gap-8">
						<div class="flex flex-col justify-center">
							<Label class="mb-2 text-[9px] font-bold text-muted-foreground uppercase"
								>Default Expiry</Label
							>
							<Select.Root
								type="single"
								value={String(configData.default_expiry)}
								onValueChange={(v) => save({ default_expiry: Number(v) })}
							>
								<Select.Trigger class="h-10 font-mono text-xl">
									{formatSeconds(configData.default_expiry).val}
									{formatSeconds(configData.default_expiry).unit}
								</Select.Trigger>
								<Select.Content>
									{#each configData.time_configs as t}
										{@const f = formatSeconds(t)}
										<Select.Item value={String(t)} label="{f.val} {f.unit}"
											>{f.val} {f.unit}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex flex-col justify-center border-l pl-8">
							<Label class="mb-2 text-[9px] font-bold text-muted-foreground uppercase"
								>Default Downloads</Label
							>
							<Select.Root
								type="single"
								value={String(configData.default_number_of_downloads)}
								onValueChange={(v) => save({ default_number_of_downloads: Number(v) })}
							>
								<Select.Trigger class="h-10 font-mono text-xl"
									>{configData.default_number_of_downloads}x</Select.Trigger
								>
								<Select.Content>
									{#each configData.download_configs as dl}
										<Select.Item value={String(dl)} label="{dl}x">{dl}x</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<div class="flex items-center gap-2">
							<Download class="size-4 text-primary" />
							<Card.Title
								class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
								>Download Presets</Card.Title
							>
						</div>
						<Button
							variant="outline"
							size="icon"
							class="size-8"
							onclick={() => {
								editing = editing === 'steps' ? null : 'steps';
								if (editing === 'steps') tempInput.dl = 1;
							}}
						>
							<Pencil class="size-3.5" />
						</Button>
					</Card.Header>
					{#if (configData?.download_configs?.length ?? 0) > LIMITS.download_preset || (editing === 'steps' && (configData?.download_configs?.length ?? 0) + 1 > LIMITS.download_preset)}
						<div in:fade class="p-4 text-xs text-destructive italic">
							User experience may be hindered if you add more than {LIMITS.download_preset} extensions.
						</div>
					{/if}
					<Card.Content
						class={'flex min-h-24 flex-col justify-center space-y-3' +
							((configData?.download_configs?.length ?? 0) > LIMITS.download_preset ||
							(editing === 'steps' &&
								(configData?.download_configs?.length ?? 0) + 1 > LIMITS.download_preset)
								? ' border border-destructive/50 bg-destructive/10'
								: '')}
					>
						{#if editing === 'steps'}
							<div in:slide class="flex gap-1">
								<Input type="number" bind:value={tempInput.dl} class="h-7 text-xs" min="1" />
								<Button
									size="sm"
									class="h-7"
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
								<Badge variant="secondary" class="text-[10px]">
									{dl}x
									{#if editing === 'steps'}
										<button
											onclick={() =>
												save({
													download_configs: configData.download_configs.filter(
														(_: number, idx: number) => idx !== i
													)
												})}
											class="ml-1 hover:text-foreground"
										>
											<X class="size-2.5" />
										</button>
									{/if}
								</Badge>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="rounded-xl border bg-card text-card-foreground shadow-sm lg:col-span-3">
					<Card.Header class="pb-2">
						<Card.Title
							class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
							>File Type Restrictions</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid gap-8 md:grid-cols-2">
						<div class="space-y-3">
							<div class="flex items-center justify-between border-b pb-2">
								<div class="flex items-center gap-2">
									<FileCheck class="size-4 text-emerald-500" />
									<Label class="text-[9px] font-bold text-muted-foreground uppercase"
										>Allowed Extensions</Label
									>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-500"
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
										class="h-7 text-xs"
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
									<span class="text-xs text-muted-foreground italic">All files allowed</span>
								{:else}
									{#each configData.allowed_file_types as type}
										<Badge
											variant="outline"
											class="flex gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300"
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
						<div class="space-y-3 md:border-l md:pl-8">
							<div class="flex items-center justify-between border-b pb-2">
								<div class="flex items-center gap-2">
									<FileExclamationPoint class="size-4 text-destructive" />
									<Label class="text-[9px] font-bold text-muted-foreground uppercase"
										>Banned Extensions</Label
									>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
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
										class="h-7 text-xs"
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
									<span class="text-xs text-muted-foreground italic">No types banned</span>
								{:else}
									{#each configData.banned_file_types as type}
										<Badge variant="destructive" class="flex gap-1 text-[10px]">
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

				<Card.Root
					class="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm lg:col-span-3"
				>
					<Card.Header class="flex flex-row items-center justify-between border-b px-6 pb-4">
						<div class="flex items-center gap-2">
							<Globe class="size-4 text-primary" />
							<Card.Title
								class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
								>Site Description</Card.Title
							>
						</div>
						<div class="flex gap-2">
							{#if editing === 'desc'}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										save({ site_description: descDraft });
										editing = null;
										editing = null;
									}}
									class="h-7 text-[10px] uppercase">Save Changes</Button
								>
							{/if}
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									if (editing === 'desc') {
										editing = null;
									} else {
										editing = 'desc';
										descDraft = configData?.site_description ?? '';
									}
								}}
								class="h-7 text-[10px] uppercase"
							>
								{editing === 'desc' ? 'Close Preview' : 'Edit Markdown'}
							</Button>
						</div>
					</Card.Header>
					<Card.Content class="p-0">
						{#if editing === 'desc'}
							<div in:slide class="grid divide-x md:grid-cols-2">
								<textarea
									bind:value={descDraft}
									class="min-h-75 resize-none bg-muted p-6 font-mono text-sm outline-none"
									rows="10"
								></textarea>
								{#if descExceeds}
									<div class="p-4 text-xs text-destructive italic">
										Limit exceeded: {descWordCount}/{LIMITS.site_description.words} words, {descCharCount}/{LIMITS
											.site_description.chars} chars, {descParagraphCount}/{LIMITS.site_description
											.paragraph} paragraphs.
									</div>
								{/if}
								<div class="max-w-none overflow-y-auto p-6">
									<div class="prose prose-zinc dark:prose-invert max-w-none">
										{@html previewHtml}
									</div>
								</div>
							</div>
						{:else}
							<div in:fade class="max-w-none p-8">
								<div class="prose prose-zinc dark:prose-invert max-w-none">{@html previewHtml}</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		{/if}
	</main>
</div>
