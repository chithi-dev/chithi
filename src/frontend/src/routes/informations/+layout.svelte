<script lang="ts">
	import { fly } from 'svelte/transition';
	import { ChevronLeft } from '@lucide/svelte';
	import favicon from '$lib/assets/logo.svg';
	import FancyGrid from '$lib/components/FancyGrid.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	const header = $derived(page.data.header);
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-card p-4 transition-colors duration-500"
>
	<FancyGrid />

	<a
		href="/"
		class="group absolute top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-background hover:text-foreground sm:top-8 sm:left-8"
	>
		<ChevronLeft class="size-4 shrink-0 transition-transform group-hover:-translate-x-1" />
		Back to Terminal
	</a>

	<div in:fly={{ y: 20, duration: 700 }} class="z-10 w-full max-w-2xl space-y-8">
		<div class="flex flex-col items-center gap-5 text-center">
			<div class="group relative">
				<div
					class="absolute -inset-4 rounded-3xl bg-primary/20 opacity-30 blur-2xl transition-all duration-500 group-hover:opacity-60"
				></div>
				<div
					class="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-primary/20 bg-background/70 shadow-lg ring-1 ring-primary/20 backdrop-blur-2xl transition-transform duration-500 group-hover:scale-105"
				>
					<img
						src={favicon}
						alt="Chithi Logo"
						class="h-14 w-14 transition-transform group-hover:scale-105"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<p class="text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
					{header?.subtitle}
				</p>
				<h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
					{header?.title}
				</h1>
				<p class="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
					{header?.description}
				</p>
			</div>
		</div>

		{@render children()}
	</div>
</div>
