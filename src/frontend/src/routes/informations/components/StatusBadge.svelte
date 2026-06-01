<script lang="ts">
  /** When true shows yellow UNSTABLE badge; when false shows green STABLE badge */
  export let isUnstable: boolean;
</script>

{#if isUnstable}
  <div class="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-yellow-600 ring-1 ring-yellow-500/30 dark:text-yellow-400">
    UNSTABLE
  </div>
{:else}
  <div class="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-green-600 ring-1 ring-green-500/30 dark:text-green-400">
    STABLE
  </div>
{/if}

</script>
