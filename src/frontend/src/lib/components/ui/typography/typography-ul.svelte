<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLUListElement> = $props();
</script>

<ul
    {...restProps}
    class={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
>
    {@render children?.()}
</ul>
