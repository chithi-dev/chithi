<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p
    {...restProps}
    class={cn("text-xl text-muted-foreground", className)}
>
    {@render children?.()}
</p>
