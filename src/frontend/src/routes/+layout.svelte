<script lang="ts">
	import '#css/tailwind.css';
	import '#css/fonts.scss';
	import '#css/nprogress.scss';


	import NProgress from 'nprogress';
	import { navigating } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	$effect(() => {
		if (navigating) {
			NProgress.start();
		} else {
			NProgress.done();
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chithi</title>
</svelte:head>

<Toaster />

<ModeWatcher />
<QueryClientProvider client={data.queryClient}>
	<!-- <SvelteQueryDevtools buttonPosition="top-left" /> -->

	{@render children()}
</QueryClientProvider>
