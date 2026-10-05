<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const attachmentVariants = tv({
		base: "rounded-xl w-fit focus-within:ring-1 focus-within:ring-ring/50 group/attachment relative flex max-w-full min-w-0 shrink-0 flex-wrap border bg-card text-card-foreground transition-colors has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
		variants: {
			size: {
				default: "gap-2 has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2 text-sm",
				sm: "gap-2.5 has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5 text-xs",
				xs: "gap-1.5 has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1 text-xs rounded-lg",
			},
			orientation: {
				horizontal: "min-w-40 items-center",
				vertical: "w-24 has-data-[slot=attachment-content]:w-30 flex-col",
			},
		},
	});

	export type AttachmentSize = VariantProps<typeof attachmentVariants>["size"];
	export type AttachmentOrientation = VariantProps<typeof attachmentVariants>["orientation"];
	export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		state = "done",
		size = "default",
		orientation = "horizontal",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		state?: AttachmentState;
		size?: AttachmentSize;
		orientation?: AttachmentOrientation;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="attachment"
	data-state={state}
	data-size={size}
	data-orientation={orientation}
	class={cn(attachmentVariants({ size, orientation }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
