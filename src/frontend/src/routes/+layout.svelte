<script lang="ts">
	import '#css/tailwind.css';
	import '#css/nprogress.scss';
	import '#css/fonts.scss';
  	import { MetaTags, deepMerge } from 'svelte-meta-tags';
  	import { afterNavigate, beforeNavigate } from "$app/navigation";
  	import { page } from '$app/state';
	import NProgress from 'nprogress';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import type { LayoutData } from './$types';
	import { onMount, type Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	
	onMount(()=>{
		NProgress.done();
	})

	beforeNavigate(()=>{
		NProgress.start();
	})
	afterNavigate(()=>{
		NProgress.done();
	})
	let metaTags = $derived(deepMerge(data.baseMetaTags, page.data.pageMetaTags));
</script>


<MetaTags {...metaTags} />
<Toaster />

<ModeWatcher />
<QueryClientProvider client={data.queryClient}>
	<!-- <SvelteQueryDevtools buttonPosition="top-left" /> -->

	{@render children()}
</QueryClientProvider>
