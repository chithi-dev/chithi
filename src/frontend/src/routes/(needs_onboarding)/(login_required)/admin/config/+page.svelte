<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Item from '$lib/components/ui/item';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Select from '$lib/components/ui/select';
	import { LoaderCircle, X } from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { useConfigQuery } from '#queries/config';
	import { B_VALS, bytesToNumber, formatBytes, type ByteUnit } from '#functions/bytes';
	import { formatSeconds, secondsToNumber, T_UNITS, type TimeUnit } from '#functions/times';
	import { sanitizeExt } from '#functions/sanitize';
	import { markdown_to_html } from '$lib/markdown/markdown';

	const { config: configQuery, update_config } = useConfigQuery();

	let configData = $derived(configQuery.data);
	let descDraft = $state('');
	let previewMarkdown = $derived(
		descDraft ? String(descDraft) : (configData?.site_description ?? '')
	);

	let editing = $state<
		'storage' | 'file' | 'desc' | 'time' | 'allowed' | 'banned' | 'steps' | null
	>(null);
	let editVal = $state(0);
	let editUnit = $state<ByteUnit>('GB');
	let tempInput = $state({
		dl: 0,
		time: 0,
		timeUnit: 'Hours' as TimeUnit,
		allowedStr: '',
		bannedStr: ''
	});

	const LIMITS = Object.freeze({
		download_preset: 8,
		time_preset: 8,
		site_description: {
			words: 150,
			paragraph: 3,
			chars: 1000
		}
	});

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

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<h2 class="text-3xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">
			Manage your <code>{page.url.origin}</code> chithi instance.
		</p>
	</div>
</div>

<div class="space-y-6">
	{#if configQuery.isFetching}
		<div
			in:fade
			class="fixed top-24 right-10 z-50 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase shadow-sm backdrop-blur-sm"
		>
			<LoaderCircle class="size-3.5 animate-spin" /> Syncing
		</div>
	{/if}

	{#if configQuery.isLoading}
		<div class="space-y-6">
			{#each Array(3) as _}
				<div class="rounded-xl border bg-card p-8">
					<div class="space-y-4">
						<Skeleton class="h-6 w-1/4" />
						<Skeleton class="h-4 w-1/2" />
						<div class="pt-4"><Skeleton class="h-10 w-full" /></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if configData}
		<Card.Root class="border bg-background">
			<Card.Header class="px-6 py-4">
				<Card.Title class="text-base font-medium">Storage & Files</Card.Title>
			</Card.Header>
			<Card.Content class="p-0">
				<Item.Group>
					<Item.Root>
						<Item.Content>
							<Item.Title>Storage Limit</Item.Title>
							<Item.Description class="line-clamp-none text-wrap">
								The total storage capacity allocated for this instance. Older files may be pruned if
								this limit is reached.
							</Item.Description>
						</Item.Content>
						<Item.Actions class="w-full flex-col items-end gap-2 md:w-auto md:min-w-75">
							{#if editing === 'storage'}
								<div in:slide class="flex w-full gap-2">
									<Input
										type="number"
										bind:value={editVal}
										class="bg-background"
										min="0"
										step="0.01"
									/>
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger class="w-25">{editUnit}</Select.Trigger>
										<Select.Content>
											{#each Object.keys(B_VALS) as u}
												<Select.Item value={u} label={u}>{u}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<div class="flex gap-2">
									<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
									<Button
										size="sm"
										onclick={() => {
											save({ total_storage_limit: bytesToNumber(editVal, editUnit) });
											editing = null;
										}}>Save</Button
									>
								</div>
							{:else}
								{@const f = formatBytes(configData.total_storage_limit)}
								<div
									class="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
								>
									<span class="font-mono font-medium">{f.val} {f.unit}</span>
								</div>
								<Button variant="outline" size="sm" onclick={() => startEdit('storage')}
									>Edit</Button
								>
							{/if}
						</Item.Actions>
					</Item.Root>

					<Item.Separator />

					<Item.Root>
						<Item.Content>
							<Item.Title>Max File Size</Item.Title>
							<Item.Description class="line-clamp-none text-wrap">
								The permissible size limit for a single file upload.
							</Item.Description>
						</Item.Content>
						<Item.Actions class="w-full flex-col items-end gap-2 md:w-auto md:min-w-75">
							{#if editing === 'file'}
								<div in:slide class="flex w-full gap-2">
									<Input
										type="number"
										bind:value={editVal}
										class="bg-background"
										min="0"
										step="0.01"
									/>
									<Select.Root type="single" bind:value={editUnit}>
										<Select.Trigger class="w-25">{editUnit}</Select.Trigger>
										<Select.Content>
											{#each Object.keys(B_VALS) as u}
												<Select.Item value={u} label={u}>{u}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
								<div class="flex gap-2">
									<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
									<Button
										size="sm"
										onclick={() => {
											save({ max_file_size_limit: bytesToNumber(editVal, editUnit) });
											editing = null;
										}}>Save</Button
									>
								</div>
							{:else}
								{@const f = formatBytes(configData.max_file_size_limit)}
								<div
									class="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
								>
									<span class="font-mono font-medium">{f.val} {f.unit}</span>
								</div>
								<Button variant="outline" size="sm" onclick={() => startEdit('file')}>Edit</Button>
							{/if}
						</Item.Actions>
					</Item.Root>
				</Item.Group>
			</Card.Content>
		</Card.Root>

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
									{formatSeconds(configData.default_expiry).val}
									{formatSeconds(configData.default_expiry).unit}
								</Select.Trigger>
								<Select.Content>
									{#each configData.time_configs as t}
										{@const f = formatSeconds(t)}
										<Select.Item value={String(t)} label="{f.val} {f.unit}">
											{f.val}
											{f.unit}
										</Select.Item>
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

					<Item.Root class="flex-col items-stretch gap-4">
						<div class="flex items-start justify-between gap-4">
							<Item.Content>
								<Item.Title>Time Presets</Item.Title>
								<Item.Description class="line-clamp-none">
									Time options available to users.
								</Item.Description>
							</Item.Content>
							<Item.Actions>
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										editing = editing === 'time' ? null : 'time';
										if (editing === 'time') {
											tempInput.time = 1;
											tempInput.timeUnit = 'Hours';
										}
									}}
								>
									{editing === 'time' ? 'Done' : 'Edit'}
								</Button>
							</Item.Actions>
						</div>

						<Item.Footer
							class="flex min-h-16 flex-wrap items-center justify-start gap-2 rounded-lg border bg-muted/20 p-4"
						>
							{#each configData.time_configs as t, i}
								{@const f = formatSeconds(t)}
								<Badge
									variant="secondary"
									class="h-8 border-border bg-background px-3 text-sm font-normal hover:bg-background"
								>
									{f.val}
									{f.unit}
									{#if editing === 'time'}
										<div class="mx-2 h-3 w-px bg-border"></div>
										<button
											onclick={() =>
												save({
													time_configs: configData.time_configs.filter(
														(_: any, idx: number) => idx !== i
													)
												})}
											class="cursor-pointer text-muted-foreground hover:text-foreground"
										>
											<X class="size-3" />
										</button>
									{/if}
								</Badge>
							{/each}
							{#if editing === 'time'}
								<div in:slide class="ml-2 flex items-center gap-2 border-l pl-2">
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
									<Button
										size="sm"
										class="h-8"
										onclick={() => {
											const secs = secondsToNumber(tempInput.time, tempInput.timeUnit);
											const newTimeConfigs = [...configData.time_configs, secs].sort(
												(a, b) => a - b
											);
											save({ time_configs: newTimeConfigs });
										}}>Add</Button
									>
								</div>
							{/if}
						</Item.Footer>
					</Item.Root>

					<Item.Separator />

					<Item.Root class="flex-col items-stretch gap-4">
						<div class="flex items-start justify-between gap-4">
							<Item.Content>
								<Item.Title>Download Limit Presets</Item.Title>
								<Item.Description class="line-clamp-none">
									Download count options available to users.
								</Item.Description>
							</Item.Content>
							<Item.Actions>
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										editing = editing === 'steps' ? null : 'steps';
										if (editing === 'steps') tempInput.dl = 1;
									}}
								>
									{editing === 'steps' ? 'Done' : 'Edit'}
								</Button>
							</Item.Actions>
						</div>

						<Item.Footer
							class="flex min-h-16 flex-wrap items-center justify-start gap-2 rounded-lg border bg-muted/20 p-4"
						>
							{#each configData.download_configs as dl, i}
								<Badge
									variant="secondary"
									class="h-8 border-border bg-background px-3 text-sm font-normal hover:bg-background"
								>
									{dl}x
									{#if editing === 'steps'}
										<div class="mx-2 h-3 w-px bg-border"></div>
										<button
											onclick={() =>
												save({
													download_configs: configData.download_configs.filter(
														(_: any, idx: number) => idx !== i
													)
												})}
											class="cursor-pointer text-muted-foreground hover:text-foreground"
										>
											<X class="size-3" />
										</button>
									{/if}
								</Badge>
							{/each}
							{#if editing === 'steps'}
								<div in:slide class="ml-2 flex items-center gap-2 border-l pl-2">
									<Input
										type="number"
										bind:value={tempInput.dl}
										class="h-8 w-20 border-border bg-background"
										min="1"
									/>
									<Button
										size="sm"
										class="h-8"
										onclick={() => {
											const newList = [...configData.download_configs, tempInput.dl].sort(
												(a, b) => a - b
											);
											save({ download_configs: newList });
										}}>Add</Button
									>
								</div>
							{/if}
						</Item.Footer>
					</Item.Root>
				</Item.Group>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border bg-background">
			<Card.Header class="px-6 py-4">
				<Card.Title class="text-base font-medium">File Security</Card.Title>
			</Card.Header>
			<Card.Content class="grid gap-4 p-6 pt-0 md:grid-cols-2">
				<Item.Root variant="outline" class="block p-4">
					<div class="space-y-4">
						<Item.Content>
							<Item.Title>Allowed Extensions</Item.Title>
							<Item.Description class="line-clamp-none"
								>Whitelist specific file types.</Item.Description
							>
						</Item.Content>
						<Item.Actions>
							<div class="flex w-full items-center gap-2">
								<Input
									placeholder="Add extension (e.g. pdf)..."
									bind:value={tempInput.allowedStr}
									onkeydown={(e: any) => {
										if (editing === 'allowed' && e.key === 'Enter') {
											const ext = sanitizeExt(tempInput.allowedStr);
											if (ext)
												save({
													allowed_file_types: [
														...new Set([...(configData.allowed_file_types || []), ext])
													]
												});
											tempInput.allowedStr = '';
										}
									}}
									onfocus={() => (editing = 'allowed')}
									class="min-w-0 flex-1 bg-background"
								/>
								{#if editing === 'allowed' && tempInput.allowedStr}
									<Button
										size="sm"
										onclick={() => {
											const ext = sanitizeExt(tempInput.allowedStr);
											if (ext)
												save({
													allowed_file_types: [
														...new Set([...(configData.allowed_file_types || []), ext])
													]
												});
											tempInput.allowedStr = '';
										}}>Add</Button
									>
								{/if}
							</div>
						</Item.Actions>
						<Item.Footer
							class="flex min-h-10 flex-wrap justify-start gap-2 rounded-md border bg-muted/20 p-3"
						>
							{#if !configData.allowed_file_types?.length}
								<span class="p-1 text-xs text-muted-foreground italic"
									>All files types are allowed.</span
								>
							{:else}
								{#each configData.allowed_file_types as type}
									<Badge
										variant="outline"
										class="gap-1 border-emerald-500/20 bg-emerald-500/10 pr-1 text-emerald-600"
									>
										{type}
										<button
											onclick={() =>
												save({
													allowed_file_types: configData.allowed_file_types.filter(
														(t: any) => t !== type
													)
												})}
											class="cursor-pointer rounded-full p-0.5 hover:bg-emerald-500/20"
										>
											<X class="size-3" />
										</button>
									</Badge>
								{/each}
							{/if}
						</Item.Footer>
					</div>
				</Item.Root>

				<Item.Root variant="outline" class="block p-4">
					<div class="space-y-4">
						<Item.Content>
							<Item.Title>Banned Extensions</Item.Title>
							<Item.Description class="line-clamp-none"
								>Blacklist specific file types.</Item.Description
							>
						</Item.Content>
						<Item.Actions>
							<div class="flex w-full items-center gap-2">
								<Input
									placeholder="Add extension (e.g. exe)..."
									bind:value={tempInput.bannedStr}
									onkeydown={(e: any) => {
										if (editing === 'banned' && e.key === 'Enter') {
											const ext = sanitizeExt(tempInput.bannedStr);
											if (ext)
												save({
													banned_file_types: [
														...new Set([...(configData.banned_file_types || []), ext])
													]
												});
											tempInput.bannedStr = '';
										}
									}}
									onfocus={() => (editing = 'banned')}
									class="min-w-0 flex-1 bg-background"
								/>
								{#if editing === 'banned' && tempInput.bannedStr}
									<Button
										size="sm"
										onclick={() => {
											const ext = sanitizeExt(tempInput.bannedStr);
											if (ext)
												save({
													banned_file_types: [
														...new Set([...(configData.banned_file_types || []), ext])
													]
												});
											tempInput.bannedStr = '';
										}}>Add</Button
									>
								{/if}
							</div>
						</Item.Actions>
						<Item.Footer
							class="flex min-h-10 flex-wrap justify-start gap-2 rounded-md border bg-muted/20 p-3"
						>
							{#if !configData.banned_file_types?.length}
								<span class="p-1 text-xs text-muted-foreground italic"
									>No file types are banned.</span
								>
							{:else}
								{#each configData.banned_file_types as type}
									<Badge
										variant="outline"
										class="gap-1 border-destructive/20 bg-destructive/10 pr-1 text-destructive"
									>
										{type}
										<button
											onclick={() =>
												save({
													banned_file_types: configData.banned_file_types.filter(
														(t: any) => t !== type
													)
												})}
											class="cursor-pointer rounded-full p-0.5 hover:bg-destructive/20"
										>
											<X class="size-3" />
										</button>
									</Badge>
								{/each}
							{/if}
						</Item.Footer>
					</div>
				</Item.Root>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border bg-background">
			<Card.Header class="flex flex-row items-center justify-between px-6 py-4">
				<div>
					<Card.Title class="text-base font-medium">Site Description</Card.Title>
					<Card.Description class="mt-1"
						>Markdown content displayed on the public homepage.</Card.Description
					>
				</div>
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
				>
					{editing === 'desc' ? 'Cancel' : 'Edit Description'}
				</Button>
			</Card.Header>
			<Card.Content class="p-0">
				{#if editing === 'desc'}
					<div in:slide class="flex flex-col">
						<div class="p-6 pb-2">
							<textarea
								bind:value={descDraft}
								class="min-h-75 w-full resize-y rounded-md border bg-background p-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
								placeholder="Enter your site description in Markdown..."
							></textarea>
							<div class="mt-2 flex justify-between text-xs text-muted-foreground">
								<span>Supports basic Markdown</span>
								<span class={descExceeds ? 'font-bold text-destructive' : ''}>
									{descWordCount}/{LIMITS.site_description.words} words
								</span>
							</div>
						</div>
						<div class="flex justify-end gap-2 border-t bg-muted/20 p-4">
							<Button variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
							<Button
								onclick={() => {
									save({ site_description: descDraft });
									editing = null;
								}}
								disabled={descExceeds}>Save Changes</Button
							>
						</div>
					</div>
				{:else}
					<div
						in:fade
						class="prose max-w-none p-8 text-sm leading-relaxed prose-zinc dark:prose-invert"
					>
						{#await markdown_to_html(previewMarkdown) then html}
							{@html html}
						{/await}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
