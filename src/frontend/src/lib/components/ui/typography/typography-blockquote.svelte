<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLQuoteElement> = $props();
</script>

<blockquote
    {...restProps}
    class={cn("mt-6 border-l-2 pl-6 italic", className)}
>
    {@render children?.()}
</blockquote>
