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
		Loader2,
		Pencil,
		X,
		Bold,
		Italic,
		Link,
		List
	} from 'lucide-svelte';
	import { fade, slide } from 'svelte/transition';
	import { marked } from 'marked';

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
		site_description: '# Welcome\nThis is a **secure** ephemeral file sharing instance.',
		download_configs: [1, 5, 10],
		time_configs: [1, 7, 30],
		allowed_file_types: ['png', 'jpg', 'pdf'],
		banned_file_types: ['exe', 'dmg']
	});

	let editing = $state<string | null>(null);
	let loadingField = $state<string | null>(null);
	let temp = $state({ ext: '', ban: '', dl: null as number | null, time: null as number | null });

	// Markdown Preview Logic
	let previewHtml = $derived(marked.parse(config.site_description));

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

	// Markdown Toolbar Helper
	function injectMarkdown(symbol: string) {
		config.site_description += symbol;
	}
</script>

<div class="min-h-screen bg-[#0a0a0a] p-8 font-sans text-white selection:bg-white/20">
	<div class="mx-auto max-w-5xl space-y-10">
		<header class="border-b border-zinc-800 pb-8">
			<h1 class="text-3xl font-bold tracking-tighter text-white">Instance Control</h1>
			<p class="mt-1 text-sm font-medium text-zinc-300">
				Configure global storage limits, security policies, and site metadata.
			</p>
		</header>

		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start justify-between pb-4">
					<div class="flex items-start gap-3">
						<HardDrive class="mt-1 size-5 text-emerald-400" strokeWidth={2.5} />
						<div class="space-y-1">
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
								>Total Storage</Card.Title
							>
							<p class="text-[10px] leading-tight font-medium text-zinc-400">
								Max capacity for all combined uploads.
							</p>
						</div>
					</div>
					<button
						onclick={() => (editing = 'storage')}
						class="cursor-pointer text-zinc-500 transition-colors hover:text-white"
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
								class="h-9 border-zinc-700 bg-black text-white"
							/>
							<Button
								size="sm"
								class="h-9 cursor-pointer bg-white font-bold text-black hover:bg-zinc-200"
								onclick={() => syncField('total_storage_limit_gb')}
							>
								{#if loadingField === 'total_storage_limit_gb'}<Loader2
										class="size-4 animate-spin"
									/>{:else}<Check class="size-4" />{/if}
							</Button>
						</div>
					{:else}
						<div class="flex items-baseline gap-1">
							<span class="text-4xl font-black tracking-tighter text-white"
								>{config.total_storage_limit_gb}</span
							>
							<span class="text-xs font-bold text-zinc-400 uppercase">GB</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start justify-between pb-4">
					<div class="flex items-start gap-3">
						<FileCode class="mt-1 size-5 text-blue-400" strokeWidth={2.5} />
						<div class="space-y-1">
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
								>File Limit</Card.Title
							>
							<p class="text-[10px] leading-tight font-medium text-zinc-400">
								Maximum size allowed per individual file.
							</p>
						</div>
					</div>
					<button
						onclick={() => (editing = 'file_size')}
						class="cursor-pointer text-zinc-500 transition-colors hover:text-white"
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
								class="h-9 border-zinc-700 bg-black text-white"
							/>
							<Button
								size="sm"
								class="h-9 cursor-pointer bg-white font-bold text-black hover:bg-zinc-200"
								onclick={() => syncField('max_file_size_mb')}
							>
								{#if loadingField === 'file_size'}<Loader2
										class="size-4 animate-spin"
									/>{:else}<Check class="size-4" />{/if}
							</Button>
						</div>
					{:else}
						<div class="flex items-baseline gap-1">
							<span class="text-4xl font-black tracking-tighter text-white"
								>{config.max_file_size_mb}</span
							>
							<span class="text-xs font-bold text-zinc-400 uppercase">MB</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start gap-3 pb-4">
					<Download class="mt-1 size-5 text-violet-400" strokeWidth={2.5} />
					<div class="space-y-1">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
							>Download Caps</Card.Title
						>
						<p class="text-[10px] leading-tight font-medium text-zinc-400">
							Set how many times a link can be used.
						</p>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex flex-wrap gap-2">
						{#each config.download_configs as dl}
							<Badge
								variant="outline"
								class="border-zinc-700 bg-zinc-900 px-2 py-1 font-mono font-bold text-violet-300"
							>
								{dl}x
								<button
									onclick={() => removeItem('download_configs', dl)}
									class="ml-2 cursor-pointer transition-transform hover:scale-110 hover:text-white"
								>
									<X class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.dl}
							placeholder="Limit"
							class="h-8 border-zinc-700 bg-black text-xs text-white"
						/>
						<Button
							onclick={() => {
								addItem('download_configs', temp.dl);
								temp.dl = null;
							}}
							variant="secondary"
							size="sm"
							class="h-8 cursor-pointer bg-zinc-800 text-[10px] font-bold text-white hover:bg-zinc-700"
							>ADD</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start gap-3 pb-4">
					<Clock class="mt-1 size-5 text-amber-400" strokeWidth={2.5} />
					<div class="space-y-1">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
							>Expiration</Card.Title
						>
						<p class="text-[10px] leading-tight font-medium text-zinc-400">
							Day-counts before a file is purged.
						</p>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex flex-wrap gap-2">
						{#each config.time_configs as t}
							<Badge
								variant="outline"
								class="border-zinc-700 bg-zinc-900 px-2 py-1 font-mono font-bold text-amber-300"
							>
								{t}d
								<button
									onclick={() => removeItem('time_configs', t)}
									class="ml-2 cursor-pointer transition-transform hover:scale-110 hover:text-white"
								>
									<X class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							type="number"
							bind:value={temp.time}
							placeholder="Days"
							class="h-8 border-zinc-700 bg-black text-xs text-white"
						/>
						<Button
							onclick={() => {
								addItem('time_configs', temp.time);
								temp.time = null;
							}}
							variant="secondary"
							size="sm"
							class="h-8 cursor-pointer bg-zinc-800 text-[10px] font-bold text-white hover:bg-zinc-700"
							>ADD</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start gap-3 pb-4">
					<ShieldCheck class="mt-1 size-5 text-emerald-400" strokeWidth={2.5} />
					<div class="space-y-1">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
							>Allowed Types</Card.Title
						>
						<p class="text-[10px] leading-tight font-medium text-zinc-400">
							Extensions authorized for upload.
						</p>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex min-h-6 flex-wrap gap-2">
						{#each config.allowed_file_types as ext}
							<Badge
								class="border border-emerald-500/50 bg-emerald-500/20 px-2 py-1 font-mono font-bold text-emerald-300"
							>
								.{ext}
								<button
									onclick={() => removeItem('allowed_file_types', ext)}
									class="ml-2 cursor-pointer transition-transform hover:scale-110 hover:text-white"
								>
									<X class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ext}
							placeholder="ext"
							class="h-8 border-zinc-700 bg-black text-xs text-white"
						/>
						<Button
							onclick={() => {
								addItem('allowed_file_types', temp.ext);
								temp.ext = '';
							}}
							size="sm"
							class="h-8 cursor-pointer bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-500"
							>ADD</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-xl border-zinc-800 bg-zinc-950/50 shadow-none">
				<Card.Header class="flex flex-row items-start gap-3 pb-4">
					<ShieldAlert class="mt-1 size-5 text-red-400" strokeWidth={2.5} />
					<div class="space-y-1">
						<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
							>Blocked Types</Card.Title
						>
						<p class="text-[10px] leading-tight font-medium text-zinc-400">
							Extensions strictly prohibited.
						</p>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex min-h-6 flex-wrap gap-2">
						{#each config.banned_file_types as ext}
							<Badge
								class="border border-red-500/50 bg-red-500/20 px-2 py-1 font-mono font-bold text-red-300"
							>
								.{ext}
								<button
									onclick={() => removeItem('banned_file_types', ext)}
									class="ml-2 cursor-pointer transition-transform hover:scale-110 hover:text-white"
								>
									<X class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
					<div class="flex gap-2">
						<Input
							bind:value={temp.ban}
							placeholder="ext"
							class="h-8 border-zinc-700 bg-black text-xs text-white"
						/>
						<Button
							onclick={() => {
								addItem('banned_file_types', temp.ban);
								temp.ban = '';
							}}
							variant="destructive"
							size="sm"
							class="h-8 cursor-pointer text-[10px] font-bold">BAN</Button
						>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 shadow-none lg:col-span-3"
			>
				<Card.Header class="flex flex-row items-start justify-between bg-zinc-900/20 pb-4">
					<div class="flex items-start gap-3">
						<Globe class="mt-1 size-5 text-sky-400" strokeWidth={2.5} />
						<div class="space-y-1">
							<Card.Title class="text-[10px] font-bold tracking-widest text-zinc-200 uppercase"
								>Site Metadata (Markdown)</Card.Title
							>
							<p class="text-[10px] leading-tight font-medium text-zinc-400">
								Use Markdown for rich text descriptions and SEO.
							</p>
						</div>
					</div>
					<button
						onclick={() => (editing = 'desc')}
						class="cursor-pointer text-zinc-500 transition-colors hover:text-white"
					>
						<Pencil class="size-3.5" />
					</button>
				</Card.Header>

				<Card.Content class="p-0">
					{#if editing === 'desc'}
						<div in:slide={{ duration: 250 }} class="flex flex-col">
							<div
								class="flex items-center gap-1 border-y border-zinc-800 bg-zinc-900/50 px-4 py-2"
							>
								<button
									onclick={() => injectMarkdown('**')}
									class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
									><Bold class="size-4" /></button
								>
								<button
									onclick={() => injectMarkdown('_')}
									class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
									><Italic class="size-4" /></button
								>
								<button
									onclick={() => injectMarkdown('[]()')}
									class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
									><Link class="size-4" /></button
								>
								<button
									onclick={() => injectMarkdown('\n- ')}
									class="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
									><List class="size-4" /></button
								>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2">
								<textarea
									bind:value={config.site_description}
									class="min-h-50 w-full border-r border-zinc-800 bg-black p-4 font-mono text-sm text-zinc-200 focus:ring-1 focus:ring-sky-500/30 focus:outline-none"
									placeholder="# Hello World..."
								></textarea>

								<div
									class="prose prose-invert prose-sm prose-headings:text-sky-400 prose-strong:text-white min-h-50 max-w-none overflow-auto bg-zinc-950 p-4"
								>
									{@html previewHtml}
								</div>
							</div>

							<div class="flex justify-end gap-3 border-t border-zinc-800 bg-zinc-900/30 p-4">
								<Button
									variant="ghost"
									size="sm"
									class="cursor-pointer text-zinc-400 hover:text-white"
									onclick={() => (editing = null)}>Cancel</Button
								>
								<Button
									size="sm"
									class="cursor-pointer bg-white px-8 font-bold text-black hover:bg-zinc-200"
									onclick={() => syncField('site_description')}
								>
									{#if loadingField === 'desc'}<Loader2 class="mr-2 size-4 animate-spin" />{/if}Save
									Markdown
								</Button>
							</div>
						</div>
					{:else}
						<div in:fade class="prose prose-invert prose-sm prose-p:leading-relaxed max-w-none p-6">
							{@html previewHtml}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<style>
	:global(.prose h1) {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		margin-bottom: 1rem;
	}
	:global(.prose h2) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 1.5rem;
	}
</style>
