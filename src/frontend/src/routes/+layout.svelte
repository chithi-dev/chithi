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
	import type { Snippet } from 'svelte';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';
	import { user_store } from '$lib/store/user.svelte';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	$effect.pre(() => {
		if (data.user) {
			user_store.authenticate();
		} else {
			user_store.unauthenticate();
		}
	});

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
	<SvelteQueryDevtools buttonPosition="top-left" />

	{@render children()}
</QueryClientProvider>
