<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import {
    HardDrive,
    Files,
    CloudDownload,
    Link as LinkIcon,
    Share2,
    Clock,
    CalendarClock,
    CircleAlert,
    TrendingUp,
    ShieldCheck
  } from '@lucide/svelte';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { useInstanceStatisticsQuery } from '$lib/queries/instance';
  import { formatFileSize } from '$lib/functions/bytes';
  import { formatDateLong } from '$lib/functions/dates';
  import InfoCard from '../components/InfoCard.svelte';

  const { stats: statsQuery } = useInstanceStatisticsQuery();
  const stats = $derived(statsQuery.data);

  const statRows = $derived([
    { Icon: HardDrive, label: 'Total Storage', value: formatFileSize(stats?.total_bytes ?? 0), cls: 'text-xl font-bold text-foreground' },
    { Icon: Files, label: 'Total Files', value: (stats?.total_files ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
    { Icon: CloudDownload, label: 'Total Downloads', value: (stats?.total_downloads ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
    { Icon: LinkIcon, label: 'Active URLs', value: (stats?.active_urls ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
    { Icon: Share2, label: 'Active Rooms', value: (stats?.active_rooms ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
    { Icon: Clock, label: 'Expiring Soon', value: (stats?.expiring_soon ?? 0).toLocaleString(), sub: 'Within next 24 hours', cls: 'text-xl font-bold text-foreground' },
    { Icon: CalendarClock, label: 'Latest Expiry', value: stats?.latest_expiry ? formatDateLong(stats.latest_expiry) : 'N/A', cls: 'text-sm font-semibold text-foreground' },
  ]);
</script>

{#if statsQuery.isLoading}
  <div class="flex h-64 items-center justify-center">
    <Spinner class="size-8 text-muted-foreground" />
  </div>
{:else if statsQuery.isError}
  <div class="flex flex-col items-center justify-center gap-4 py-12 text-destructive">
    <CircleAlert class="h-12 w-12" />
    <p class="font-medium">Failed to load instance statistics</p>
    <Button variant="outline" onclick={() => statsQuery.refetch()}>Retry</Button>
  </div>
{:else if stats}
  <InfoCard
    headerIcon={TrendingUp}
    title="Instance Statistics"
    description="Overview of storage and usage metrics."
    watermarkIcon={TrendingUp}
  >
    {#snippet body()}
      {#each statRows as row (row.label)}
        <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
          <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            <row.Icon size={12} />
            {row.label}
          </div>
          <p class={row.cls}>{row.value}</p>
          {#if row.sub}<p class="text-[10px] text-muted-foreground">{row.sub}</p>{/if}
        </div>
      {/each}

      <div class="group relative col-span-full flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            <ShieldCheck class="h-3 w-3" />
            Data Integrity
          </div>
        </div>
        <div class="mt-2 text-sm text-muted-foreground">
          This instance is currently managing <span class="font-semibold text-foreground">{stats?.active_urls ?? 0}</span>
          active links with a combined size of
          <span class="font-semibold text-foreground">{formatFileSize(stats?.total_bytes ?? 0)}</span>.
        </div>
      </div>
    {/snippet}
  </InfoCard>
{/if}
