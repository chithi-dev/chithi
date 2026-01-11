<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as Tabs from '$lib/components/ui/tabs';
	import { resolve_partial_path } from '@/functions/urls';

	let { children } = $props();

	const tabs: { name: string; href: string }[] = [
		{ name: 'Profile', href: './user' },
		{ name: 'Project Settings', href: './config' },
		{ name: 'Outstanding URLs', href: './urls' }
	];
</script>

<div class="w-full flex-1 bg-background pb-20">
	<Tabs.Root value={page.url.pathname} class="w-full">
		<div class="mx-auto flex w-full max-w-5xl items-center px-6 pt-6 md:px-10">
			<Tabs.List
				class="grid w-100 grid-cols-(--cols)"
				style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))"
			>
				{#each tabs as tab}
					<Tabs.Trigger
						class="cursor-pointer"
						value={resolve_partial_path(tab.href)}
						onclick={() => goto(tab.href)}
					>
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
