<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import { Scrollbar } from './index';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import { createVirtualizer, type VirtualizerOptions } from '@tanstack/svelte-virtual';
	import type { VirtualItem } from '@tanstack/virtual-core';
	import type { Snippet } from 'svelte';

	let {
		ref = $bindable(null),
		viewportRef = $bindable(null),
		class: className,
		orientation = 'vertical',
		scrollbarXClasses = '',
		scrollbarYClasses = '',
		virtualOptions,
		item,
		children,
		...restProps
	}: WithoutChild<ScrollAreaPrimitive.RootProps> & {
		orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
		scrollbarXClasses?: string | undefined;
		scrollbarYClasses?: string | undefined;
		viewportRef?: HTMLElement | null;
		virtualOptions?:
			| Omit<VirtualizerOptions<HTMLElement, HTMLElement>, 'getScrollElement'>
			| undefined;
		item?: Snippet<[VirtualItem]> | undefined;
	} = $props();

	const virtualizer = $derived(
		virtualOptions && viewportRef
			? createVirtualizer({ ...virtualOptions, getScrollElement: () => viewportRef })
			: null
	);

	const virtualItems = $derived($virtualizer?.getVirtualItems() ?? []);
	const totalSize = $derived($virtualizer?.getTotalSize() ?? 0);
</script>

<ScrollAreaPrimitive.Root
	bind:ref
	data-slot="scroll-area"
	class={cn('relative', className)}
	{...restProps}
>
	<ScrollAreaPrimitive.Viewport
		bind:ref={viewportRef}
		data-slot="scroll-area-viewport"
		class="size-full rounded-[inherit] ring-ring/10 outline-ring/50 transition-[color,box-shadow] focus-visible:ring-4 focus-visible:outline-1 dark:ring-ring/20 dark:outline-ring/40"
	>
		{#if virtualizer && item}
			<div style="height: {totalSize}px; position: relative;">
				{#each virtualItems as row (row.index)}
					<div
						style="position: absolute; top: 0; transform: translateY({row.start}px); width: 100%; height: {row.size}px;"
					>
						{@render item(row)}
					</div>
				{/each}
			</div>
		{:else}
			{@render children?.()}
		{/if}
	</ScrollAreaPrimitive.Viewport>
	{#if orientation === 'vertical' || orientation === 'both'}
		<Scrollbar orientation="vertical" class={scrollbarYClasses} />
	{/if}
	{#if orientation === 'horizontal' || orientation === 'both'}
		<Scrollbar orientation="horizontal" class={scrollbarXClasses} />
	{/if}
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
