<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { SiPython, SiFastapi, SiRedis, SiPostgresql } from '@icons-pack/svelte-simple-icons';
	import { Server, Tag, ShieldCheck, CircleAlert } from '@lucide/svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { useInstanceInformationQuery } from '$lib/queries/instance';
	import { client } from '$lib/graphql/client.js';
	import { INSTANCE_INFO_QUERY } from '$lib/graphql/queries.js';
	import InfoCard from '../components/InfoCard.svelte';
	import StatusBadge from '../components/StatusBadge.svelte';
	import CommitLink from '../components/CommitLink.svelte';

	const { info: instanceQuery } = useInstanceInformationQuery();
	const info = $derived(instanceQuery.data);
	const commitUrl = $derived(
		info?.commit === 'dev'
			? 'https://github.com/chithi-dev/chithi'
			: `https://github.com/chithi-dev/chithi/commit/${info?.commit}`
	);

	const infoRows = $derived([
		{ Icon: SiPython, label: 'Python Runtime', value: info?.python_version },
		{ Icon: SiFastapi, label: 'FastAPI Framework', value: info?.fastapi_version },
		{ Icon: SiRedis, label: 'Redis Cache', value: info?.redis_version },
		{ Icon: SiPostgresql, label: 'PostgreSQL DB', value: info?.postgres_version }
	]);
</script>

{#if instanceQuery.isLoading}
	<div class="flex h-64 items-center justify-center">
		<Spinner class="size-8 text-muted-foreground" />
	</div>
{:else if instanceQuery.error !== null}
	<div class="flex flex-col items-center justify-center gap-4 py-12 text-destructive">
		<CircleAlert class="h-12 w-12" />
		<p class="font-medium">Failed to load backend information</p>
		<Button variant="outline" onclick={() => client.query({ query: INSTANCE_INFO_QUERY })}
			>Retry</Button
		>
	</div>
{:else if info}
	<InfoCard
		headerIcon={Server}
		title="Service Stack"
		description="Core technologies powering this instance."
		watermarkIcon={ShieldCheck}
		showFooter
	>
		{#snippet body()}
			{#each infoRows as row (row.label)}
				<div
					class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
				>
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<row.Icon size={12} />
						{row.label}
					</div>
					<p class="text-sm font-semibold text-foreground">{row.value}</p>
				</div>
			{/each}

			<div
				class="group relative col-span-full flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4"
			>
				<div class="flex items-center justify-between gap-3">
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<Tag class="h-3 w-3" />
						Backend Version
					</div>
					<StatusBadge isUnstable={!info.is_release} />
				</div>
				<div
					class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
				>
					{info.version}
				</div>
				<div class="mt-4 flex items-center justify-between">
					<CommitLink href={commitUrl} sha={info.commit} />
				</div>
			</div>
		{/snippet}
	</InfoCard>
{/if}
