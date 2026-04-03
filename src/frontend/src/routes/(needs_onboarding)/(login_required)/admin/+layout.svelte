<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index';
	import { Separator } from '$lib/components/ui/separator/index';
	import AppSidebar from './app-sidebar.svelte';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="flex flex-col">
		<header
			class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
			<div class="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
				<span>Admin Panel</span>
			</div>
		</header>
		<main class="flex-1 overflow-auto p-6">
			<div class="w-full max-w-none">
				{@render children?.()}
			</div>
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>
