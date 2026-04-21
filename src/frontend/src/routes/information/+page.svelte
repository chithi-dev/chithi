<script lang="ts">
	import { fly } from 'svelte/transition';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import {
		Info,
		GitCommitHorizontal,
		Tag,
		BookOpen,
		ExternalLink,
		ShieldCheck,
		ChevronLeft
	} from 'lucide-svelte';
	import favicon from '$lib/assets/logo.svg';
	import AnimatedGrid from '$lib/components/AnimatedGrid.svelte';

	const version = __APP_VERSION__;
	const commit = __COMMIT_SHA__;
	const repo = 'https://github.com/chithi-dev/chithi';
	const commitUrl = `${repo}/commit/${commit}`;

	const isDevelopment = version.startsWith('v0.0.0');
	const shortCommit = commit.slice(0, 12);
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-card p-4 transition-colors duration-500"
>
	<AnimatedGrid />

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
					SYSTEM INFORMATION
				</p>
				<h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
					Chithi Instance
				</h1>
				<p class="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
					Version, source revision, and runtime metadata for this deployment.
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
						<Info class="h-4 w-4" />
					</div>
					System Specifications
				</Card.Title>
				<Card.Description>
					These values are embedded at build time so you can identify exactly which instance is
					running.
				</Card.Description>
			</Card.Header>

			<Card.Content class="grid gap-4">
				<div class="grid gap-4 sm:grid-cols-3">
					<div
						class="group relative flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4 sm:col-span-2"
					>
						<div class="flex items-center justify-between gap-3">
							<div
								class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
							>
								<Tag class="h-3 w-3" />
								Build Signature
							</div>
							{#if isDevelopment}
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
						<div
							class="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
						>
							{version}
						</div>

						<div
							class="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.07]"
						>
							<ShieldCheck class="h-24 w-24" />
						</div>
					</div>

					<div
						class="flex flex-col justify-between rounded-xl border border-border/60 bg-background/60 p-4"
					>
						<div
							class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
						>
							<ShieldCheck class="h-3 w-3" />
							Deployment
						</div>
						<div class="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
							<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></div>
							{isDevelopment ? 'Local Node' : 'Production Cluster'}
						</div>
						<p class="mt-2 text-xs text-muted-foreground">
							{isDevelopment
								? 'Built for fast local iteration and testing.'
								: 'Built for hardened uptime and multi-user traffic.'}
						</p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div
						class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
					>
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
							title={commit}
							class="group flex items-center gap-2 font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80"
						>
							<span class="truncate">{shortCommit}</span>
							<ExternalLink
								class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
							/>
						</a>
						<p class="truncate font-mono text-xs text-muted-foreground">{commit}</p>
					</div>

					<div
						class="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-muted/40"
					>
						<div
							class="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
						>
							<ExternalLink class="h-3 w-3" />
							Project Links
						</div>
						<a
							href={repo}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
						>
							<span class="truncate">github.com/chithi-dev/chithi</span>
							<ExternalLink
								class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
							/>
						</a>
						<p class="text-xs text-muted-foreground">
							Read docs for deployment notes and configuration references.
						</p>
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

		<div class="flex justify-center pt-1">
			<Button
				variant="ghost"
				href="/"
				class="group gap-2 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase transition-colors hover:text-foreground"
			>
				<House class="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
				Back to Terminal
			</Button>
		</div>
	</div>
</div>
