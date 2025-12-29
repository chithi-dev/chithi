<script lang="ts">
	import { SunIcon, Send, MoonIcon } from 'lucide-svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { toggleMode } from 'mode-watcher';

	let { children } = $props();
</script>

<div class="flex min-h-screen min-w-screen flex-col bg-background text-foreground">
	<!-- Top Bar -->
	<header class="flex items-center justify-between border-b border-border p-4">
		<div class="flex items-center">
			<Send class="h-6 w-6 text-primary" />
			<h1 class="ml-2 text-2xl font-bold md:text-xl">Send</h1>
		</div>

		<Button
			variant="outline"
			size="icon"
			onclick={(e) => {
				e.preventDefault();
				toggleMode();
			}}
		>
			<SunIcon
				class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
			/>
			<MoonIcon
				class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
			/>
			<span class="sr-only">Toggle theme</span>
		</Button>
	</header>

	<!-- Main Content -->
	{@render children()}

	<!-- Footer -->
	<footer class="border-t border-border p-4">
		<div class="mx-auto w-full max-w-6xl">
			<nav
				class="flex flex-row flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground md:gap-6"
			>
				<a href="#" class="font-medium whitespace-nowrap transition-colors hover:text-foreground"
					>Donate</a
				>
				<a href="#" class="font-medium whitespace-nowrap transition-colors hover:text-foreground"
					>CLI</a
				>
				<a href="#" class="font-medium whitespace-nowrap transition-colors hover:text-foreground"
					>DMCA</a
				>
				<a href="#" class="font-medium whitespace-nowrap transition-colors hover:text-foreground"
					>Source</a
				>
			</nav>
		</div>
	</footer>
</div>
