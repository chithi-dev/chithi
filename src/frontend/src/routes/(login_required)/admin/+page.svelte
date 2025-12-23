<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		HardDrive,
		FileCode,
		Clock,
		Download,
		ShieldAlert,
		ShieldCheck,
		Globe,
		Check,
		X,
		Loader2,
		Plus,
		Pencil
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';

	interface AppConfig {
		total_storage_limit_gb: number;
		max_file_size_mb: number;
		site_description: string;
		download_configs: number[];
		time_configs: number[];
		allowed_file_types: string[];
		banned_file_types: string[];
	}

	let config = $state<AppConfig>({
		total_storage_limit_gb: 50,
		max_file_size_mb: 500,
		site_description: 'Secure, ephemeral file sharing instance.',
		download_configs: [1, 5, 10],
		time_configs: [1, 7, 30],
		allowed_file_types: ['png', 'jpg', 'pdf'],
		banned_file_types: ['exe', 'dmg']
	});

	let editing = $state<string | null>(null);
	let loadingField = $state<string | null>(null);

	let temp = $state({
		ext: '',
		ban: '',
		dl: null as number | null,
		time: null as number | null
	});

	async function syncField(fieldId: keyof AppConfig) {
		loadingField = fieldId;
		await new Promise((r) => setTimeout(r, 600));
		editing = null;
		loadingField = null;
	}

	function addItem<K extends keyof AppConfig>(field: K, value: any) {
		if (value === '' || value === null) return;

		// We cast to any[] here to resolve the "never" diagnostic
		const targetArray = config[field] as any[];

		if (!targetArray.includes(value)) {
			targetArray.push(value);
			if (typeof value === 'number') {
				targetArray.sort((a, b) => a - b);
			}
			syncField(field);
		}
	}

	function removeItem<K extends keyof AppConfig>(field: K, value: any) {
		// We cast to any[] to allow filtering without type mismatch
		(config[field] as any[]) = (config[field] as any[]).filter((i) => i !== value);
		syncField(field);
	}
</script>

<div class="min-h-screen bg-[#fafafa] p-6 text-zinc-900 dark:bg-[#080808] dark:text-zinc-100">
	<div class="mx-auto max-w-5xl space-y-10">
		<header>
			<h1 class="text-3xl font-bold tracking-tighter">Admin Panel</h1>
			<p class="text-sm font-medium text-zinc-500">
				Global configurations for your Chithi deployment.
			</p>
		</header>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			<Card.Root
				class="overflow-hidden border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Total Capacity</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Server-wide storage limit.</p>
					</div>
					<button onclick={() => (editing = 'storage')}
						><Pencil class="size-3.5 text-zinc-400 hover:text-black" /></button
					>
				</Card.Header>
				<Card.Content class="min-h-15">
					{#if editing === 'storage'}
						<div in:fade={{ duration: 200 }} out:fade={{ duration: 150 }} class="flex gap-2">
							<Input type="number" bind:value={config.total_storage_limit_gb} class="h-8" />
							<Button
								size="icon"
								class="h-8 w-10 bg-black text-white"
								onclick={() => syncField('total_storage_limit_gb')}
							>
								{#if loadingField === 'total_storage_limit_gb'}<Loader2
										class="size-3 animate-spin"
									/>{:else}<Check class="size-3" />{/if}
							</Button>
						</div>
					{:else}
						<div in:fade={{ duration: 200 }} class="flex items-center gap-3">
							<HardDrive class="size-5 text-zinc-300" />
							<span class="text-3xl font-bold tracking-tighter"
								>{config.total_storage_limit_gb}GB</span
							>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="overflow-hidden border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Upload Limit</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Max size per single file.</p>
					</div>
					<button onclick={() => (editing = 'file_size')}
						><Pencil class="size-3.5 text-zinc-400 hover:text-black" /></button
					>
				</Card.Header>
				<Card.Content class="min-h-15">
					{#if editing === 'file_size'}
						<div in:fade={{ duration: 200 }} out:fade={{ duration: 150 }} class="flex gap-2">
							<Input type="number" bind:value={config.max_file_size_mb} class="h-8" />
							<Button
								size="icon"
								class="h-8 w-10 bg-black text-white"
								onclick={() => syncField('max_file_size_mb')}
							>
								{#if loadingField === 'max_file_size_mb'}<Loader2
										class="size-3 animate-spin"
									/>{:else}<Check class="size-3" />{/if}
							</Button>
						</div>
					{:else}
						<div in:fade={{ duration: 200 }} class="flex items-center gap-3">
							<FileCode class="size-5 text-zinc-300" />
							<span class="text-3xl font-bold tracking-tighter">{config.max_file_size_mb}MB</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Download Steps</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Limit options (times).</p>
					</div>
					<Download class="size-3.5 text-zinc-300" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex flex-wrap gap-1.5">
						{#each config.download_configs as dl}
							<Badge variant="secondary" class="h-6 font-mono text-[10px]"
								>{dl}x
								<button
									onclick={() => removeItem('download_configs', dl)}
									class="ml-1 opacity-50 hover:opacity-100">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.dl}
							placeholder="Count"
							class="h-7 text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('download_configs', temp.dl)}
						/>
						<Button
							onclick={() => {
								addItem('download_configs', temp.dl);
								temp.dl = null;
							}}
							variant="outline"
							size="sm"
							class="h-7 text-[10px]">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Time Steps</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Validity options (days).</p>
					</div>
					<Clock class="size-3.5 text-zinc-300" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex flex-wrap gap-1.5">
						{#each config.time_configs as t}
							<Badge variant="outline" class="h-6 font-mono text-[10px]"
								>{t}d
								<button
									onclick={() => removeItem('time_configs', t)}
									class="ml-1 opacity-50 hover:opacity-100">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.time}
							placeholder="Days"
							class="h-7 text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('time_configs', temp.time)}
						/>
						<Button
							onclick={() => {
								addItem('time_configs', temp.time);
								temp.time = null;
							}}
							variant="outline"
							size="sm"
							class="h-7 text-[10px]">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
							>Whitelist</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Specifically allowed formats.</p>
					</div>
					<ShieldCheck class="size-4 text-emerald-100" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.allowed_file_types as ext}
							<Badge class="h-6 border-emerald-100 bg-emerald-50 text-[10px] text-emerald-700"
								>.{ext}
								<button onclick={() => removeItem('allowed_file_types', ext)} class="ml-1">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ext}
							placeholder="pdf..."
							class="h-7 text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('allowed_file_types', temp.ext)}
						/>
						<Button
							onclick={() => {
								addItem('allowed_file_types', temp.ext);
								temp.ext = '';
							}}
							variant="outline"
							size="sm"
							class="h-7 text-[10px]">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-red-500 uppercase"
							>Blacklist</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Specifically blocked formats.</p>
					</div>
					<ShieldAlert class="size-4 text-red-100" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.banned_file_types as ext}
							<Badge class="h-6 border-red-100 bg-red-50 text-[10px] text-red-700"
								>.{ext}
								<button onclick={() => removeItem('banned_file_types', ext)} class="ml-1">×</button>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ban}
							placeholder="exe..."
							class="h-7 text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('banned_file_types', temp.ban)}
						/>
						<Button
							onclick={() => {
								addItem('banned_file_types', temp.ban);
								temp.ban = '';
							}}
							variant="outline"
							size="sm"
							class="h-7 text-[10px]">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="overflow-hidden border-zinc-200 bg-white shadow-sm lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-950"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<div class="space-y-0.5">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-400 uppercase"
							>Site SEO Description</Card.Title
						>
						<p class="text-[10px] text-zinc-500">Displayed in search results.</p>
					</div>
					<button onclick={() => (editing = 'desc')}
						><Pencil class="size-3.5 text-zinc-400 hover:text-black" /></button
					>
				</Card.Header>
				<Card.Content class="relative min-h-12.5">
					{#if editing === 'desc'}
						<div in:slide={{ duration: 300 }} out:slide={{ duration: 300 }} class="space-y-4">
							<textarea
								bind:value={config.site_description}
								class="min-h-25 w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
							></textarea>
							<div class="flex justify-end gap-2 pb-2">
								<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
								<Button
									size="sm"
									class="bg-black px-6 text-white"
									onclick={() => syncField('site_description')}
								>
									{#if loadingField === 'desc'}<Loader2
											class="mr-2 size-3 animate-spin"
										/>{/if}Update
								</Button>
							</div>
						</div>
					{:else}
						<div in:slide={{ duration: 300 }} class="flex items-center gap-3 py-2">
							<Globe class="size-4 shrink-0 text-zinc-300" />
							<p class="text-sm font-medium italic">"{config.site_description}"</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
