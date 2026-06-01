<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    HardDrive,
    Files,
    CloudDownload,
    Link as LinkIcon,
    Share2,
    Clock,
    CalendarClock,
    LoaderCircle,
    CircleAlert,
    TrendingUp,
    ShieldCheck
  } from '@lucide/svelte';
  import { useInstanceStatisticsQuery } from '$lib/queries/instance';
  import { formatFileSize } from '$lib/functions/bytes';
  import { formatDateLong } from '$lib/functions/dates';
  import InfoCard from './components/InfoCard.svelte';

  const statsQuery = useInstanceStatisticsQuery();
  const stats = $derived(statsQuery.data);
</script>

{#if statsQuery.isLoading}
  <div class="flex h-64 items-center justify-center">
    <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
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
    <!-- Total Storage -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <HardDrive size={12} />
        Total Storage
      </div>
      <p class="text-xl font-bold text-foreground">{formatFileSize(stats.total_bytes)}</p>
    </div>

    <!-- Total Files -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <Files size={12} />
        Total Files
      </div>
      <p class="text-xl font-bold text-foreground">{stats.total_files.toLocaleString()}</p>
    </div>

    <!-- Total Downloads -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <CloudDownload size={12} />
        Total Downloads
      </div>
      <p class="text-xl font-bold text-foreground">{stats.total_downloads.toLocaleString()}</p>
    </div>

    <!-- Active URLs -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <LinkIcon size={12} />
        Active URLs
      </div>
      <p class="text-xl font-bold text-foreground">{stats.active_urls.toLocaleString()}</p>
    </div>

    <!-- Active Rooms -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <Share2 size={12} />
        Active Rooms
      </div>
      <p class="text-xl font-bold text-foreground">{stats.active_rooms.toLocaleString()}</p>
    </div>

    <!-- Expiring Soon -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <Clock size={12} />
        Expiring Soon
      </div>
      <p class="text-xl font-bold text-foreground">{stats.expiring_soon.toLocaleString()}</p>
      <p class="text-[10px] text-muted-foreground">Within next 24 hours</p>
    </div>

    <!-- Latest Expiry -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <CalendarClock size={12} />
        Latest Expiry
      </div>
      <p class="text-sm font-semibold text-foreground">
        {stats.latest_expiry ? formatDate(stats.latest_expiry) : 'N/A'}
      </p>
    </div>

    <!-- Summary Card -->
    <div class="group relative col-span-full flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          <ShieldCheck class="h-3 w-3" />
          Data Integrity
        </div>
      </div>
      <div class="mt-2 text-sm text-muted-foreground">
        This instance is currently managing <span class="font-semibold text-foreground">{stats.active_urls}</span>
        active links with a combined size of
        <span class="font-semibold text-foreground">{formatFileSize(stats.total_bytes)}</span>.
      </div>
    </div>
  </InfoCard>
{/if}
