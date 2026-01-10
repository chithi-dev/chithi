<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as Tabs from '$lib/components/ui/tabs';

	let { children } = $props();

	const tabs = [
		{ name: 'Profile', href: '/admin/user' },
		{ name: 'Project Settings', href: '/admin/config' }
	];
</script>

<div class="min-h-screen w-full bg-background pb-20">
	<Tabs.Root value={page.url.pathname} class="w-full">
		<div class="mx-auto flex w-full max-w-5xl items-center px-6 pt-6 md:px-10">
			<Tabs.List class="grid w-100 grid-cols-2">
				{#each tabs as tab}
					<Tabs.Trigger value={tab.href} onclick={() => goto(tab.href)}>
						{tab.name}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</div>

		<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 md:p-10">
			<div class="flex-1 space-y-6">
				{@render children()}
			</div>
		</main>
	</Tabs.Root>
</div>
