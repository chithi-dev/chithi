<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { RefreshCw, ShieldAlert } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { onMount, type Component } from 'svelte';

	let error = $derived(page.error);
	let status = $derived(page.status);

	type BrowserInfo = { name: string; version: string; major?: number };
	let browser = $state<BrowserInfo>({ name: 'Unknown', version: '' });

	const browser_mapping: Array<{
		browser_name: string;
		browser_url: string;
		browser_min_version: number;
		browser_logo: () => Promise<{ default: Component }>;
	}> = [
		{
			browser_name: 'Google Chrome',
			browser_url: 'https://www.google.com/chrome/',
			browser_min_version: 80,
			browser_logo: () => import('$lib/logos/chrome.svelte')
		},
		{
			browser_name: 'Mozilla Firefox',
			browser_url: 'https://www.mozilla.org/firefox/new/',
			browser_min_version: 75,
			browser_logo: () => import('$lib/logos/firefox.svelte')
		},
		{
			browser_name: 'Apple Safari',
			browser_url: 'https://support.apple.com/downloads/safari',
			browser_min_version: 14,
			browser_logo: () => import('$lib/logos/safari.svelte')
		},
		{
			browser_name: 'Microsoft Edge',
			browser_url: 'https://www.microsoft.com/edge',
			browser_min_version: 80,
			browser_logo: () => import('$lib/logos/edge.svelte')
		}
	];

	onMount(() => {
		if (typeof navigator === 'undefined') return;
		const ua = navigator.userAgent;
		let m: RegExpMatchArray | null;
		if ((m = ua.match(/Edg\/([\d.]+)/i))) {
			browser = { name: 'Microsoft Edge', version: m[1], major: parseInt(m[1].split('.')[0]) };
		} else if ((m = ua.match(/Chrome\/([\d.]+)/i))) {
			browser = { name: 'Google Chrome', version: m[1], major: parseInt(m[1].split('.')[0]) };
		} else if ((m = ua.match(/Firefox\/([\d.]+)/i))) {
			browser = { name: 'Mozilla Firefox', version: m[1], major: parseInt(m[1].split('.')[0]) };
		} else if ((m = ua.match(/Version\/([\d.]+).*Safari/i))) {
			browser = { name: 'Apple Safari', version: m[1], major: parseInt(m[1].split('.')[0]) };
		} else {
			browser = { name: navigator.appName || 'Unknown', version: navigator.appVersion || '' };
		}
	});

	function reload() {
		location.reload();
	}
</script>

{#snippet browserLink(
	name: string,
	url: string,
	version: number,
	Logo: () => Promise<{ default: Component }>
)}
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		class="group flex flex-col items-center transition-transform duration-200 hover:-translate-y-0.5"
		title="{name} {version}+"
	>
		<div
			class="h-8 w-8 grayscale transition-all duration-300 group-hover:scale-110 group-hover:grayscale-0 [&>svg]:h-full [&>svg]:w-full"
		>
			{#await Logo() then { default: Comp }}
				<Comp />
			{/await}
		</div>
		<span class="mt-1 font-mono text-[10px] opacity-60 group-hover:opacity-100">{version}+</span>
	</a>
{/snippet}

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-24 -left-24 h-125 w-125 rounded-full bg-red-500/10 blur-[120px] dark:bg-red-500/10"
		></div>
		<div
			class="absolute -right-24 -bottom-24 h-125 w-125 rounded-full bg-orange-500/10 blur-[120px] dark:bg-orange-500/10"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_90%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<div in:fly={{ y: 20, duration: 800 }} class="z-10 w-full max-w-md">
		<Card.Root
			class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-red-500/40 to-transparent"
			></div>

			<Card.Header class="space-y-3 pt-10 pb-8 text-center">
				<div
					class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500 shadow-sm ring-1 ring-red-200 dark:border-red-500/20 dark:bg-red-500/10 dark:ring-red-500/20"
				>
					<ShieldAlert class="size-8" />
				</div>
				<div class="space-y-1">
					<Card.Title class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{#if status === 404}
							Page Not Found
						{:else if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
							Security Check Failed
						{:else if error?.code === 'BROWSER_NOT_UPDATED'}
							Browser Not Supported
						{:else}
							Something went wrong
						{/if}
					</Card.Title>
					<Card.Description class="text-sm text-slate-500 dark:text-zinc-400">
						{#if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
							Your environment is not secure enough.
						{:else if error?.code === 'BROWSER_NOT_UPDATED'}
							Your browser is missing required security features.
						{:else if error?.message}
							{error.message}
						{:else}
							An unexpected error occurred.
						{/if}
					</Card.Description>
				</div>
			</Card.Header>

			<Card.Content class="text-center text-sm text-slate-600 dark:text-zinc-400">
				{#if error?.code === 'WEBCRYPTO_UNAVAILABLE'}
					<p>
						This application requires the <strong>WebCrypto API</strong> to ensure your data remains secure.
					</p>
					<p class="mt-2">
						Please ensure you are using a modern browser and accessing this site via <strong
							>HTTPS</strong
						>.
					</p>
				{:else if error?.code === 'BROWSER_NOT_UPDATED'}
					<p>
						This application requires modern cryptographic features (AES-GCM, HKDF, PBKDF2) that
						your browser does not fully support.
					</p>
					<div class="mt-4 rounded-lg bg-slate-100 p-3 text-left text-xs dark:bg-zinc-800/50">
						<p class="mb-2 font-semibold text-slate-900 dark:text-white">
							Minimum Recommended Versions:
						</p>

						<div class="flex justify-center gap-6 pt-2">
							{#each browser_mapping as item}
								{@render browserLink(
									item.browser_name,
									item.browser_url,
									item.browser_min_version,
									item.browser_logo
								)}
							{/each}
						</div>
					</div>

					{#if browser.version}
						<div
							class="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400"
						>
							<span class="font-semibold">Detected browser</span>
							<span class="font-mono">{browser.name} {browser.version}</span>
						</div>
					{/if}
				{:else}
					<p>We encountered an error while processing your request. Please try again later.</p>
				{/if}
			</Card.Content>

			<Card.Footer
				class="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 py-6 dark:border-zinc-800/50 dark:bg-zinc-950/40"
			>
				<Button class="w-full shadow-lg shadow-red-500/20 hover:bg-red-600" onclick={reload}>
					<RefreshCw class="mr-2 size-4" />
					Try Again
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
