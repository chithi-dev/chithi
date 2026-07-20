<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLHeadingElement> = $props();
</script>

<h4
    {...restProps}
    class={cn("scroll-m-20 text-xl font-semibold tracking-tight", className)}
>
    {@render children?.()}
</h4>
