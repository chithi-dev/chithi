<script lang="ts">
  import { dev } from '$app/environment';
  import { Info, Tag, ShieldCheck } from '@lucide/svelte';
  import InfoCard from './components/InfoCard.svelte';
  import StatusBadge from './components/StatusBadge.svelte';
  import CommitLink from './components/CommitLink.svelte';

  const version = __APP_VERSION__ ?? '0.0.0-dev';
  const commit = __COMMIT_SHA__ ?? 'unknown';
  const repo = 'https://github.com/chithi-dev/chithi';
  const commitUrl = commit === 'unknown' ? repo : `${repo}/commit/${commit}`;
</script>

<InfoCard
  headerIcon={Info}
  title="System Specifications"
  description="These values are embedded at build time."
  showFooter
>
  <div class="group relative flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <Tag class="h-3 w-3" />
        Build Signature
      </div>
      <StatusBadge isUnstable={dev} />
    </div>
    <div class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      {version}
    </div>
    <p class="mt-2 text-xs text-muted-foreground">
      {dev
        ? 'Running in local mode for rapid iteration.'
        : 'Running in production mode for uptime and scale.'}
    </p>

    <div class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.07]">
      <ShieldCheck class="h-24 w-24" />
    </div>
  </div>

  <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
    <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
      {dev ? 'Local Development' : 'Source Revision'}
    </div>
    {#if dev}
      <p class="text-sm font-semibold text-foreground">Running from your local workspace.</p>
      <p class="text-xs text-muted-foreground">Revision links are shown on production builds.</p>
    {:else}
      <CommitLink href={commitUrl} sha={commit} />
      <p class="text-xs text-muted-foreground">
        Open this revision in GitHub for full diff and metadata.
      </p>
    {/if}
  </div>
</InfoCard>
