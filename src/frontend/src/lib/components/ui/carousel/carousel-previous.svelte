<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { Button, type Props } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";
	import { getEmblaContext } from "./context.js";
	import type { WithoutChildren } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		variant = "outline",
		size = "icon-sm",
		...restProps
	}: WithoutChildren<Props> = $props();

	const emblaCtx = getEmblaContext("<Carousel.Previous/>");
</script>

<Button
	data-slot="carousel-previous"
	{variant}
	{size}
	aria-disabled={!emblaCtx.canScrollPrev}
	disabled={!emblaCtx.canScrollPrev}
	class={cn(
		"rounded-full absolute touch-manipulation",
		emblaCtx.orientation === "horizontal"
			? "inset-y-0 -start-12 my-auto"
			: "start-1/2 -top-12 -translate-x-1/2 rotate-90",
		className
	)}
	onclick={emblaCtx.scrollPrev}
	onkeydown={emblaCtx.handleKeyDown}
	{...restProps}
	bind:ref
>
	<ChevronLeftIcon class="cn-rtl-flip" />
	<span class="sr-only">Previous slide</span>
</Button>
