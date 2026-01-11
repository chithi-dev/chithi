<script lang="ts">
	import './layout.css';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	import { page } from '$app/state';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { goto } from '$app/navigation';
	import { useOnboarding } from '$lib/queries/onboarding';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chithi</title>
</svelte:head>

<Toaster />

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<SvelteQueryDevtools />

	{@render children()}
</QueryClientProvider>
