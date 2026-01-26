<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './app-sidebar.svelte';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<main class="min-h-screen w-full flex-1 p-6">
		<Sidebar.Trigger />
		<div class="w-full max-w-none">
			{@render children?.()}
		</div>
	</main>
</Sidebar.Provider>
