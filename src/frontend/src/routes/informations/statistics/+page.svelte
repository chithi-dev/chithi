<script lang="ts">
	import * as Card from '$lib/components/ui/card';
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

	const statsQuery = useInstanceStatisticsQuery();

	const stats = $derived(statsQuery.data);

	const formatDate = (timestamp: number) => {
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date(timestamp * 1000));
	};
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
	<Card.Root
		class="relative overflow-hidden border border-border/60 bg-card/75 shadow-[0_12px_40px_rgb(0,0,0,0.06)] backdrop-blur-2xl"
	>
		<div
			class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/50 to-transparent"
		></div>

		<Card.Header class="space-y-2 pb-2">
			<Card.Title class="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
				>
					<TrendingUp class="h-4 w-4" />
				</div>
				Instance Statistics
			</Card.Title>
			<Card.Description>Overview of storage and usage metrics.</Card.Description>
		</Card.Header>

		<Card.Content class="grid gap-4 sm:grid-cols-2">
			<!-- Total Storage -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<HardDrive size={12} />
					Total Storage
				</div>
				<p class="text-xl font-bold text-foreground">{formatFileSize(stats.total_bytes)}</p>
			</div>

			<!-- Total Files -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<Files size={12} />
					Total Files
				</div>
				<p class="text-xl font-bold text-foreground">{stats.total_files.toLocaleString()}</p>
			</div>

			<!-- Total Downloads -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<CloudDownload size={12} />
					Total Downloads
				</div>
				<p class="text-xl font-bold text-foreground">{stats.total_downloads.toLocaleString()}</p>
			</div>

			<!-- Active URLs -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<LinkIcon size={12} />
					Active URLs
				</div>
				<p class="text-xl font-bold text-foreground">{stats.active_urls.toLocaleString()}</p>
			</div>

			<!-- Active Rooms -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<Share2 size={12} />
					Active Rooms
				</div>
				<p class="text-xl font-bold text-foreground">{stats.active_rooms.toLocaleString()}</p>
			</div>

			<!-- Expiring Soon -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<Clock size={12} />
					Expiring Soon
				</div>
				<p class="text-xl font-bold text-foreground">{stats.expiring_soon.toLocaleString()}</p>
				<p class="text-[10px] text-muted-foreground">Within next 24 hours</p>
			</div>

			<!-- Latest Expiry -->
			<div
				class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
			>
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<CalendarClock size={12} />
					Latest Expiry
				</div>
				<p class="text-sm font-semibold text-foreground">
					{stats.latest_expiry ? formatDate(stats.latest_expiry) : 'N/A'}
				</p>
			</div>

			<!-- Summary Card -->
			<div
				class="group relative col-span-full flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4"
			>
				<div class="flex items-center justify-between gap-3">
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<ShieldCheck class="h-3 w-3" />
						Data Integrity
					</div>
				</div>
				<div class="mt-2 text-sm text-muted-foreground">
					This instance is currently managing <span class="font-semibold text-foreground"
						>{stats.active_urls}</span
					>
					active links with a combined size of
					<span class="font-semibold text-foreground">{formatFileSize(stats.total_bytes)}</span>.
				</div>

				<div
					class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.07]"
				>
					<TrendingUp class="h-24 w-24" />
				</div>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
