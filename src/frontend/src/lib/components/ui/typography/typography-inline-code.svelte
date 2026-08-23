<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<code
    {...restProps}
    class={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        className
    )}
>
    {@render children?.()}
</code>
