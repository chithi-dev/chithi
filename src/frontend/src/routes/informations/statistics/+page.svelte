<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		HardDrive,
		Files,
		CheckCircle,
		XCircle,
		Users,
		CircleAlert,
		TrendingUp,
		ShieldCheck
	} from '@lucide/svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { useInstanceStatisticsQuery } from '$lib/queries/instance';
	import { client } from '$lib/graphql/client.js';
	import { INSTANCE_STATS_QUERY } from '$lib/graphql/queries.js';
	import { formatFileSize } from '$lib/functions/bytes';
	import InfoCard from '../components/InfoCard.svelte';

	const { stats: statsQuery } = useInstanceStatisticsQuery();
	const stats = $derived(statsQuery.data);

	const statRows = $derived([
		{ Icon: HardDrive, label: 'Total Storage', value: formatFileSize(stats?.totalStorageUsed ?? 0), cls: 'text-xl font-bold text-foreground' },
		{ Icon: Files, label: 'Total Files', value: (stats?.totalFiles ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
		{ Icon: CheckCircle, label: 'Active Files', value: (stats?.activeFiles ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
		{ Icon: XCircle, label: 'Expired Files', value: (stats?.expiredFiles ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
		{ Icon: Users, label: 'Total Users', value: (stats?.totalUsers ?? 0).toLocaleString(), cls: 'text-xl font-bold text-foreground' },
	]);
</script>

{#if statsQuery.isLoading}
	<div class="flex h-64 items-center justify-center">
		<Spinner class="size-8 text-muted-foreground" />
	</div>
{:else if statsQuery.error !== null}
	<div class="flex flex-col items-center justify-center gap-4 py-12 text-destructive">
		<CircleAlert class="h-12 w-12" />
		<p class="font-medium">Failed to load instance statistics</p>
		<Button variant="outline" onclick={() => client.query({ query: INSTANCE_STATS_QUERY })}>Retry</Button>
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
					This instance is currently managing <span class="font-semibold text-foreground">{stats?.activeFiles ?? 0}</span>
					active files with a combined size of
					<span class="font-semibold text-foreground">{formatFileSize(stats?.totalStorageUsed ?? 0)}</span>.
				</div>
			</div>
		{/snippet}
	</InfoCard>
{/if}
