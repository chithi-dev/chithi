<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { SiPython, SiFastapi, SiRedis, SiPostgresql } from '@icons-pack/svelte-simple-icons';
  import { Server, Tag, ShieldCheck, LoaderCircle, CircleAlert } from '@lucide/svelte';
  import { useInstanceInformationQuery } from '$lib/queries/instance';
  import InfoCard from './components/InfoCard.svelte';
  import StatusBadge from './components/StatusBadge.svelte';
  import CommitLink from './components/CommitLink.svelte';

  const instanceQuery = useInstanceInformationQuery();
  const info = $derived(instanceQuery.data);
  const commitUrl = $derived(info?.commit === 'dev'
    ? 'https://github.com/chithi-dev/chithi'
    : `https://github.com/chithi-dev/chithi/commit/${info?.commit}`);
</script>

{#if instanceQuery.isLoading}
  <div class="flex h-64 items-center justify-center">
    <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
{:else if instanceQuery.isError}
  <div class="flex flex-col items-center justify-center gap-4 py-12 text-destructive">
    <CircleAlert class="h-12 w-12" />
    <p class="font-medium">Failed to load backend information</p>
    <Button variant="outline" onclick={() => instanceQuery.refetch()}>Retry</Button>
  </div>
{:else if info}
  <InfoCard
    headerIcon={Server}
    title="Service Stack"
    description="Core technologies powering this instance."
    watermarkIcon={ShieldCheck}
    showFooter
  >
    <!-- Python Version -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <SiPython size={12} />
        Python Runtime
      </div>
      <p class="text-sm font-semibold text-foreground">{info.python_version}</p>
    </div>

    <!-- FastAPI Version -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <SiFastapi size={12} />
        FastAPI Framework
      </div>
      <p class="text-sm font-semibold text-foreground">{info.fastapi_version}</p>
    </div>

    <!-- Redis Version -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <SiRedis size={12} />
        Redis Cache
      </div>
      <p class="text-sm font-semibold text-foreground">{info.redis_version}</p>
    </div>

    <!-- Postgres Version -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40">
      <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <SiPostgresql size={12} />
        PostgreSQL DB
      </div>
      <p class="text-sm font-semibold text-foreground">{info.postgres_version}</p>
    </div>

    <!-- Build Info Card -->
    <div class="group relative col-span-full flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          <Tag class="h-3 w-3" />
          Backend Version
        </div>
        <StatusBadge isUnstable={!info.is_release} />
      </div>
      <div class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {info.version}
      </div>

      <div class="mt-4 flex items-center justify-between">
        <CommitLink href={commitUrl} sha={info.commit} />
      </div>
    </div>
  </InfoCard>
{/if}
