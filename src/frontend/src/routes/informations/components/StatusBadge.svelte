<script lang="ts">
  import { Badge, badgeVariants } from '$lib/components/ui/badge/index.js';
  let { isUnstable }: { isUnstable: boolean } = $props();
</script>

{#if isUnstable}
  <Badge class={badgeVariants({ variant: 'secondary' })}>UNSTABLE</Badge>
{:else}
  <Badge class={badgeVariants({ variant: 'default' })}>STABLE</Badge>
{/if}
