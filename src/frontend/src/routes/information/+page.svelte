<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Info, GitCommit, Tag, BookOpen, ExternalLink, ShieldCheck, House } from 'lucide-svelte';
	import favicon from '$lib/assets/logo.svg';

	const version = __APP_VERSION__;
	const commit = __COMMIT_SHA__;
	const repo = 'https://github.com/chithi-dev/chithi';
	const commitUrl = `${repo}/commit/${commit}`;

	const isDevelopment = version.startsWith('v0.0.0');
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<!-- Ultra-fancy Background Elements -->
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-48 -left-48 h-150 w-150 animate-pulse rounded-full bg-primary/10 blur-[140px] transition-all duration-1000 dark:bg-primary/20"
		></div>
		<div
			class="absolute top-1/2 left-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px] dark:bg-indigo-500/10"
		></div>
		<div
			class="absolute -right-48 -bottom-48 h-150 w-150 animate-pulse rounded-full bg-blue-500/10 blur-[140px] transition-all delay-700 duration-1000 dark:bg-blue-500/20"
		></div>

		<!-- Grid Pattern -->
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_80%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<div class="z-10 w-full max-w-xl space-y-10">
		<!-- Brand Section with Fancy Glow -->
		<div class="flex flex-col items-center space-y-6 text-center">
			<div class="group relative">
				<!-- Multiple Glow Layers -->
				<div
					class="absolute -inset-6 animate-pulse rounded-full bg-primary/20 blur-3xl transition-all duration-700 group-hover:bg-primary/30"
				></div>
				<div
					class="absolute -inset-2 rounded-full bg-linear-to-tr from-primary via-blue-500 to-indigo-600 opacity-40 blur-lg transition-all duration-500 group-hover:opacity-70 group-hover:blur-xl"
				></div>

				<!-- Logo Container -->
				<div
					class="relative flex h-28 w-28 items-center justify-center rounded-4xl border border-white/40 bg-white/20 shadow-2xl backdrop-blur-3xl transition-transform duration-500 group-hover:scale-105 dark:border-zinc-700/40 dark:bg-zinc-900/30"
				>
					<img
						src={favicon}
						alt="Chithi Logo"
						class="h-16 w-16 drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
					/>
				</div>
			</div>

			<div class="space-y-3">
				<h1
					class="bg-linear-to-b from-slate-900 to-slate-600 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl dark:from-white dark:to-zinc-500"
				>
					Chithi
				</h1>
				<p class="max-w-100 text-lg font-medium text-slate-500 dark:text-zinc-400">
					The future of private, secure, and ephemeral file sharing.
				</p>
			</div>
		</div>

		<Card.Root
			class="relative overflow-hidden border-slate-200/60 bg-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-3xl transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:border-zinc-800/50 dark:bg-zinc-900/40"
		>
			<!-- Animated Top Border -->
			<div
				class="absolute top-0 left-0 h-0.5 w-full bg-linear-to-r from-transparent via-primary to-transparent opacity-60"
			></div>

			<Card.Header class="pb-4">
				<Card.Title class="flex items-center gap-2.5 text-xl font-bold tracking-tight">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<Info class="h-5 w-5" />
					</div>
					System Specifications
				</Card.Title>
			</Card.Header>

			<Card.Content class="grid gap-6">
				<!-- Version High-Tech Display -->
				<div
					class="group relative flex flex-col gap-1 overflow-hidden rounded-2xl border border-slate-200/50 bg-slate-50/40 p-5 transition-all hover:bg-slate-100/60 dark:border-zinc-800/50 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/40"
				>
					<div class="flex items-center justify-between">
						<div
							class="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500"
						>
							<Tag class="h-3 w-3" />
							Build Signature
						</div>
						{#if isDevelopment}
							<div
								class="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-yellow-600 ring-1 ring-yellow-500/20 dark:text-yellow-500"
							>
								UNSTABLE
							</div>
						{:else}
							<div
								class="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-green-600 ring-1 ring-green-500/20 dark:text-green-400"
							>
								STABLE
							</div>
						{/if}
					</div>
					<div
						class="mt-2 font-mono text-3xl font-black tracking-tighter text-slate-900 dark:text-white"
					>
						{version}
					</div>

					<!-- Decorative Element -->
					<div
						class="absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]"
					>
						<ShieldCheck class="h-24 w-24" />
					</div>
				</div>

				<!-- Secondary Metrics -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div
						class="flex flex-col gap-2 rounded-2xl border border-slate-200/50 bg-slate-50/40 p-4 transition-all hover:bg-slate-100/60 dark:border-zinc-800/50 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/40"
					>
						<div
							class="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500"
						>
							<GitCommit class="h-3 w-3" />
							Source Index
						</div>
						<a
							href={commitUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-center gap-2 font-mono text-sm font-bold text-primary transition-colors hover:text-primary/70"
						>
							<span class="truncate">{commit}</span>
							<ExternalLink
								class="h-3 w-3 shrink-0 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
							/>
						</a>
					</div>

					<div
						class="flex flex-col gap-2 rounded-2xl border border-slate-200/50 bg-slate-50/40 p-4 transition-all hover:bg-slate-100/60 dark:border-zinc-800/50 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/40"
					>
						<div
							class="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500"
						>
							<ShieldCheck class="h-3 w-3" />
							Deployment
						</div>
						<div class="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
							<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"></div>
							{isDevelopment ? 'Local Node' : 'Production Cluster'}
						</div>
					</div>
				</div>
			</Card.Content>

			<Card.Footer class="pt-2">
				<Button
					variant="outline"
					class="h-12 w-full gap-2 rounded-xl border-slate-200/60 bg-white/50 text-base font-bold transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary dark:border-zinc-800/60 dark:bg-zinc-950/50 dark:hover:bg-primary/10"
					href="https://docs.chithi.dev"
					target="_blank"
				>
					<BookOpen class="h-5 w-5" />
					Documentation
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- Bottom Navigation -->
		<div class="flex flex-col items-center gap-6 text-center">
			<div
				class="h-px w-12 bg-linear-to-r from-transparent via-slate-300 to-transparent dark:via-zinc-700"
			></div>
			<Button
				variant="ghost"
				href="/"
				class="group gap-3 text-xs font-bold tracking-[0.3em] text-slate-400 uppercase transition-all hover:text-primary dark:text-zinc-500"
			>
				<House class="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
				Back to Terminal
			</Button>
		</div>
	</div>
</div>

<style>
	:root {
		--primary-rgb: 59, 130, 246; /* Default blue primary */
	}
</style>
