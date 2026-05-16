<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { dev } from '$app/environment';
	import {
		Info,
		GitCommitHorizontal,
		Tag,
		BookOpen,
		ExternalLink,
		ShieldCheck
	} from '@lucide/svelte';

	const version = __APP_VERSION__ ?? '0.0.0-dev';
	const commit = __COMMIT_SHA__ ?? 'unknown';
	const repo = 'https://github.com/chithi-dev/chithi';
	const commitUrl = commit === 'unknown' ? repo : `${repo}/commit/${commit}`;

	const shortCommit = commit.slice(0, 12);
</script>

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
				<Info class="h-4 w-4" />
			</div>
			System Specifications
		</Card.Title>
		<Card.Description>These values are embedded at build time.</Card.Description>
	</Card.Header>

	<Card.Content class="grid gap-4 sm:grid-cols-2">
		<div
			class="group relative flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4"
		>
			<div class="flex items-center justify-between gap-3">
				<div
					class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
				>
					<Tag class="h-3 w-3" />
					Build Signature
				</div>
				{#if dev}
					<div
						class="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-yellow-600 ring-1 ring-yellow-500/30 dark:text-yellow-400"
					>
						UNSTABLE
					</div>
				{:else}
					<div
						class="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-green-600 ring-1 ring-green-500/30 dark:text-green-400"
					>
						STABLE
					</div>
				{/if}
			</div>
			<div class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
				{version}
			</div>
			<p class="mt-2 text-xs text-muted-foreground">
				{dev
					? 'Running in local mode for rapid iteration.'
					: 'Running in production mode for uptime and scale.'}
			</p>

			<div
				class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.07]"
			>
				<ShieldCheck class="h-24 w-24" />
			</div>
		</div>

		<div
			class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
		>
			<div
				class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
			>
				<GitCommitHorizontal class="h-3 w-3" />
				{dev ? 'Local Development' : 'Source Revision'}
			</div>
			{#if dev}
				<p class="text-sm font-semibold text-foreground">Running from your local workspace.</p>
				<p class="text-xs text-muted-foreground">Revision links are shown on production builds.</p>
			{:else}
				<a
					href={commitUrl}
					target="_blank"
					rel="noopener noreferrer"
					title={commit}
					class="group flex items-center gap-2 font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80"
				>
					<span class="truncate">{shortCommit}</span>
					<ExternalLink
						class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
					/>
				</a>
				<p class="text-xs text-muted-foreground">
					Open this revision in GitHub for full diff and metadata.
				</p>
			{/if}
		</div>
	</Card.Content>

	<Card.Footer class="grid gap-2 border-t border-border/50 bg-muted/40 py-4 sm:grid-cols-2">
		<Button
			variant="outline"
			class="h-11 w-full gap-2 border-border/70 bg-background/70 font-semibold hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
			href={repo}
			target="_blank"
			rel="noopener noreferrer"
		>
			<ExternalLink class="h-4 w-4" />
			Repository
		</Button>

		<Button
			variant="outline"
			class="h-11 w-full gap-2 border-border/70 bg-background/70 font-semibold hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
			href="https://docs.chithi.dev"
			target="_blank"
			rel="noopener noreferrer"
		>
			<BookOpen class="h-4 w-4" />
			Documentation
		</Button>
	</Card.Footer>
</Card.Root>
