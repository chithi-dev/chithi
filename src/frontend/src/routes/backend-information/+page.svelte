<script lang="ts">
	import { fly } from 'svelte/transition';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import {
		SiPython,
		SiFastapi,
		SiRedis,
		SiPostgresql,
		SiGithub
	} from '@icons-pack/svelte-simple-icons';
	import {
		Server,
		GitCommitHorizontal,
		Tag,
		BookOpen,
		ExternalLink,
		ShieldCheck,
		ChevronLeft,
		Database,
		Zap,
		Binary
	} from 'lucide-svelte';
	import favicon from '$lib/assets/logo.svg';
	import FancyGrid from '$lib/components/FancyGrid.svelte';

	let { data } = $props();
	const info = $derived(data.info);

	const repo = 'https://github.com/chithi-dev/chithi';
	const commitUrl = $derived(
		info.commit === 'dev' ? repo : `${repo}/commit/${info.commit}`
	);
	const shortCommit = $derived(info.commit.slice(0, 12));
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-card p-4 transition-colors duration-500"
>
	<FancyGrid />

	<a
		href="/"
		class="group absolute top-6 left-6 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-background hover:text-foreground sm:top-8 sm:left-8"
	>
		<ChevronLeft class="size-4 shrink-0 transition-transform group-hover:-translate-x-1" />
		Back to Terminal
	</a>

	<div in:fly={{ y: 20, duration: 700 }} class="z-10 w-full max-w-2xl space-y-8">
		<div class="flex flex-col items-center gap-5 text-center">
			<div class="group relative">
				<div
					class="absolute -inset-4 rounded-3xl bg-primary/20 opacity-30 blur-2xl transition-all duration-500 group-hover:opacity-60"
				></div>
				<div
					class="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-primary/20 bg-background/70 shadow-lg ring-1 ring-primary/20 backdrop-blur-2xl transition-transform duration-500 group-hover:scale-105"
				>
					<img
						src={favicon}
						alt="Chithi Logo"
						class="h-14 w-14 transition-transform group-hover:scale-105"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<p class="text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
					BACKEND INFRASTRUCTURE
				</p>
				<h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
					Chithi Backend
				</h1>
				<p class="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
					Runtime environment, service versions, and architectural metadata.
				</p>
			</div>
		</div>

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
						<Server class="h-4 w-4" />
					</div>
					Service Stack
				</Card.Title>
				<Card.Description>Core technologies powering this instance.</Card.Description>
			</Card.Header>

			<Card.Content class="grid gap-4 sm:grid-cols-2">
				<!-- Python Version -->
				<div
					class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
				>
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<SiPython size="12" />
						Python Runtime
					</div>
					<p class="text-sm font-semibold text-foreground">{info.python_version}</p>
				</div>

				<!-- FastAPI Version -->
				<div
					class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
				>
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<SiFastapi size="12" />
						FastAPI Framework
					</div>
					<p class="text-sm font-semibold text-foreground">{info.fastapi_version}</p>
				</div>

				<!-- Redis Version -->
				<div
					class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
				>
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<SiRedis size="12" />
						Redis Cache
					</div>
					<p class="text-sm font-semibold text-foreground">{info.redis_version}</p>
				</div>

				<!-- Postgres Version -->
				<div
					class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
				>
					<div
						class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
					>
						<SiPostgresql size="12" />
						PostgreSQL DB
					</div>
					<p class="text-sm font-semibold text-foreground">{info.postgres_version}</p>
				</div>

				<!-- Build Info Card -->
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
						{#if !info.is_release}
							<div
								class="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-yellow-600 ring-1 ring-yellow-500/30 dark:text-yellow-400"
							>
								DEVELOPMENT
							</div>
						{:else}
							<div
								class="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-green-600 ring-1 ring-green-500/30 dark:text-green-400"
							>
								RELEASE
							</div>
						{/if}
					</div>
					<div
						class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
					>
						{info.version}
					</div>
					
					<div class="mt-4 flex items-center justify-between">
						<div class="space-y-1">
							<div
								class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
							>
								<GitCommitHorizontal class="h-3 w-3" />
								Source Revision
							</div>
							<a
								href={commitUrl}
								target="_blank"
								rel="noopener noreferrer"
								title={info.commit}
								class="group flex items-center gap-2 font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80"
							>
								<span class="truncate">{shortCommit}</span>
								<ExternalLink
									class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
								/>
							</a>
						</div>
					</div>

					<div
						class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.07]"
					>
						<ShieldCheck class="h-24 w-24" />
					</div>
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
					<SiGithub size="16" />
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
	</div>
</div>
