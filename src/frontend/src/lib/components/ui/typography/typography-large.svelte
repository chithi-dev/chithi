<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
    {...restProps}
    class={cn("text-xl font-semibold", className)}
>
    {@render children?.()}
</div>
