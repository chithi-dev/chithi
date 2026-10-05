<script lang="ts">
  import 'temporal-polyfill';
  import '#css/fonts.scss';
  import '#css/nprogress.scss';
  import '#css/tailwind.css';

  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import NProgress from 'nprogress';

  import favicon from '$lib/assets/logo.svg';
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$lib/components/ui/sonner/index.js';
  import CommandPalette from '$lib/components/CommandPalette.svelte';

  import { hydrate as hydrateAuth } from '$lib/auth/store.svelte';
import type { LayoutData } from './$types';
  import { type Component, type Snippet } from 'svelte';
  import { MetaTags, deepMerge } from 'svelte-meta-tags';
  import HydrationBoundary from '$lib/graphql/hydration-boundary.svelte';

  let { children, data }: { children: Snippet; data: LayoutData } = $props();

  // Server-prefetched Apollo cache (if any). Populated by +layout.server.ts or
  // any child +page.server.ts that calls prefetchApollo(). Shape:
  // { cache: Record, dehydratedAt: number }.
  let apolloState = $derived(data.__APOLLO__ ?? null);

  // Hydrate the auth store from the server-resolved session whenever the
  // layout data changes (initial load, `invalidate('session')` after login/logout).
  $effect(() => {
    hydrateAuth(data.session);
  });

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
<CommandPalette />
<ModeWatcher />

<HydrationBoundary state={apolloState}>
  {@render children()}
</HydrationBoundary>
