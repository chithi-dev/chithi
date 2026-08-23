<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<small
    {...restProps}
    class={cn("text-sm font-medium leading-none", className)}
>
    {@render children?.()}
</small>
