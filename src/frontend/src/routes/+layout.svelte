<script lang="ts">
	import '#css/fonts.scss';
	import '#css/nprogress.scss';
	import '#css/tailwind.css';

	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import NProgress from 'nprogress';
	import favicon from '$lib/assets/logo.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner/index';
	import type { LayoutData } from './$types';
	import { type Component, type Snippet } from 'svelte';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	async function loadDevtools() {
		if (!import.meta.env.DEV) return null;

		const mod = await import('@tanstack/svelte-query-devtools');
		return mod.SvelteQueryDevtools;
	}

	let SvelteQueryDevtools = $state<Component<any> | null>(null);

	if (import.meta.env.DEV) {
		loadDevtools().then((c) => {
			SvelteQueryDevtools = c;
		});
	}

	// NProgress
	$effect.pre(() => {
		NProgress.done();
	});
	beforeNavigate(() => {
		NProgress.start();
	});
	afterNavigate(() => {
		NProgress.done();
	});

	let metaTags = $derived(deepMerge(data.baseMetaTags, page.data.pageMetaTags));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chithi</title>
</svelte:head>

<MetaTags {...metaTags} />

<Toaster />

<ModeWatcher />
<QueryClientProvider client={data.queryClient}>
	{#if SvelteQueryDevtools}
		<!-- <SvelteQueryDevtools buttonPosition="top-left" /> -->
	{/if}

	{@render children()}
</QueryClientProvider>
