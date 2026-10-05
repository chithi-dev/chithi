<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from "$lib/utils.js";
    let { class: className, children, ...restProps }: HTMLAttributes<HTMLTableElement> = $props();
</script>

<div class={cn("my-6 w-full overflow-y-auto", className)}>
    <table {...restProps}>
        {@render children?.()}
    </table>
</div>
