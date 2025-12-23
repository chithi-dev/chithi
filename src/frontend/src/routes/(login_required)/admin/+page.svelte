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
		const targetArray = config[field] as any[];
		if (!targetArray.includes(value)) {
			targetArray.push(value);
			if (typeof value === 'number') targetArray.sort((a, b) => a - b);
			syncField(field);
		}
	}

	function removeItem<K extends keyof AppConfig>(field: K, value: any) {
		(config[field] as any[]) = (config[field] as any[]).filter((i) => i !== value);
		syncField(field);
	}
</script>

<div class="min-h-screen bg-background p-6 font-sans text-foreground selection:bg-primary/10">
	<div class="mx-auto max-w-5xl space-y-10">
		<header class="border-b border-border pb-6">
			<h1 class="text-2xl font-bold tracking-tight">System Configuration</h1>
			<p class="text-sm font-medium text-muted-foreground">
				Manage storage, security, and lifecycle constraints.
			</p>
		</header>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
						>Total Capacity</Card.Title
					>
					<button
						onclick={() => (editing = 'storage')}
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						<Pencil class="size-3.5" />
					</button>
				</Card.Header>
				<Card.Content class="min-h-16">
					{#if editing === 'storage'}
						<div in:fade class="flex gap-2">
							<Input
								type="number"
								bind:value={config.total_storage_limit_gb}
								class="h-8 border-input bg-background"
							/>
							<Button
								size="sm"
								class="h-8 bg-primary text-primary-foreground"
								onclick={() => syncField('total_storage_limit_gb')}
							>
								{#if loadingField === 'total_storage_limit_gb'}<Loader2
										class="size-3 animate-spin"
									/>{:else}<Check class="size-4" />{/if}
							</Button>
						</div>
					{:else}
						<div in:fade class="flex items-center gap-3">
							<HardDrive class="size-5 text-muted-foreground/40" />
							<span class="text-3xl font-bold tracking-tighter"
								>{config.total_storage_limit_gb}GB</span
							>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
						>Max Upload</Card.Title
					>
					<button
						onclick={() => (editing = 'file_size')}
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						<Pencil class="size-3.5" />
					</button>
				</Card.Header>
				<Card.Content class="min-h-16">
					{#if editing === 'file_size'}
						<div in:fade class="flex gap-2">
							<Input
								type="number"
								bind:value={config.max_file_size_mb}
								class="h-8 border-input bg-background"
							/>
							<Button
								size="sm"
								class="h-8 bg-primary text-primary-foreground"
								onclick={() => syncField('max_file_size_mb')}
							>
								{#if loadingField === 'max_file_size_mb'}<Loader2
										class="size-3 animate-spin"
									/>{:else}<Check class="size-4" />{/if}
							</Button>
						</div>
					{:else}
						<div in:fade class="flex items-center gap-3">
							<FileCode class="size-5 text-muted-foreground/40" />
							<span class="text-3xl font-bold tracking-tighter">{config.max_file_size_mb}MB</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
						>Download Steps</Card.Title
					>
					<Download class="size-3.5 text-muted-foreground/40" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.download_configs as dl}
							<Badge variant="secondary" class="h-6 font-mono text-[10px]">
								{dl}x
								<button
									onclick={() => removeItem('download_configs', dl)}
									class="ml-1 opacity-50 hover:text-destructive">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.dl}
							placeholder="Count"
							class="h-7 bg-background text-[10px]"
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

			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
						>Expiry Options</Card.Title
					>
					<Clock class="size-3.5 text-muted-foreground/40" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.time_configs as t}
							<Badge variant="outline" class="h-6 bg-background font-mono text-[10px]">
								{t}d
								<button
									onclick={() => removeItem('time_configs', t)}
									class="ml-1 opacity-50 hover:text-destructive">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.time}
							placeholder="Days"
							class="h-7 bg-background text-[10px]"
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

			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-primary uppercase"
						>Whitelist</Card.Title
					>
					<ShieldCheck class="size-4 text-primary/30" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.allowed_file_types as ext}
							<Badge class="h-6 bg-primary text-[10px] text-primary-foreground">
								.{ext}
								<button
									onclick={() => removeItem('allowed_file_types', ext)}
									class="ml-1 opacity-80 hover:opacity-100">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ext}
							placeholder="zip..."
							class="h-7 bg-background text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('allowed_file_types', temp.ext)}
						/>
						<Button
							onclick={() => {
								addItem('allowed_file_types', temp.ext);
								temp.ext = '';
							}}
							size="sm"
							class="h-7 bg-primary text-[10px] text-primary-foreground">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-border bg-card text-card-foreground shadow-none">
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-destructive uppercase"
						>Blacklist</Card.Title
					>
					<ShieldAlert class="size-4 text-destructive/30" />
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex min-h-6 flex-wrap gap-1.5">
						{#each config.banned_file_types as ext}
							<Badge variant="destructive" class="h-6 font-mono text-[10px]">
								.{ext}
								<button
									onclick={() => removeItem('banned_file_types', ext)}
									class="ml-1 opacity-80 hover:opacity-100">×</button
								>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ban}
							placeholder="exe..."
							class="h-7 bg-background text-[10px]"
							onkeydown={(e) => e.key === 'Enter' && addItem('banned_file_types', temp.ban)}
						/>
						<Button
							onclick={() => {
								addItem('banned_file_types', temp.ban);
								temp.ban = '';
							}}
							variant="destructive"
							size="sm"
							class="h-7 text-[10px]">Add</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="overflow-hidden rounded-xl border-border bg-card text-card-foreground shadow-none lg:col-span-3"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
						>Site SEO Description</Card.Title
					>
					<button
						onclick={() => (editing = 'desc')}
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						<Pencil class="size-3.5" />
					</button>
				</Card.Header>
				<Card.Content class="min-h-16 pt-2">
					{#if editing === 'desc'}
						<div in:slide={{ duration: 300 }} class="space-y-4">
							<textarea
								bind:value={config.site_description}
								class="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
							></textarea>
							<div class="flex justify-end gap-2 pb-2">
								<Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
								<Button
									size="sm"
									class="bg-primary px-6 font-bold text-primary-foreground"
									onclick={() => syncField('site_description')}
								>
									{#if loadingField === 'desc'}<Loader2 class="mr-2 size-3 animate-spin" />{/if}Save
									Meta
								</Button>
							</div>
						</div>
					{:else}
						<div in:fade class="flex items-start gap-3 py-2">
							<Globe class="mt-1 size-4 shrink-0 text-muted-foreground/40" />
							<p class="text-sm leading-relaxed font-medium italic">"{config.site_description}"</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
