<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLOListElement> = $props();
</script>

<ol
    {...restProps}
    class={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)}
>
    {@render children?.()}
</ol>
