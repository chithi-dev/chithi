<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p
    {...restProps}
    class={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
>
    {@render children?.()}
</p>
