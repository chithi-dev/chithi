<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { SiGithub } from '@icons-pack/svelte-simple-icons';
	import { Info, GitCommit, Tag, BookOpen, ExternalLink, ShieldCheck, Home } from 'lucide-svelte';
	import favicon from '$lib/assets/logo.svg';

	const repo = 'https://github.com/chithi-dev/chithi';
	const version = __APP_VERSION__;
	const commit = __COMMIT_SHA__;
	const commitUrl = `${repo}/commit/${commit}`;

	const isDevelopment = version.startsWith('v0.0.0');
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<!-- Background Elements inspired by onboarding page -->
	<div class="absolute inset-0 z-0">
		<div
			class="absolute -top-24 -left-24 h-125 w-125 rounded-full bg-blue-500/10 blur-[120px] dark:bg-primary/20"
		></div>
		<div
			class="absolute -right-24 -bottom-24 h-125 w-125 rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-500/10"
		></div>
		<div
			class="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_90%)] bg-size-[40px_40px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
		></div>
	</div>

	<div class="z-10 w-full max-w-xl space-y-8">
		<!-- Brand Section -->
		<div class="flex flex-col items-center space-y-4 text-center">
			<div class="relative">
				<div
					class="absolute -inset-1 rounded-full bg-linear-to-r from-primary to-blue-600 opacity-25 blur-lg"
				></div>
				<img src={favicon} alt="Chithi Logo" class="relative h-20 w-20" />
			</div>
			<div class="space-y-2">
				<h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Chithi</h1>
				<p class="max-w-[400px] text-lg text-slate-500 dark:text-zinc-400">
					Private, secure, and ephemeral file sharing.
				</p>
			</div>
		</div>

		<Card.Root
			class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
		>
			<div
				class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
			></div>

			<Card.Header class="pb-4">
				<Card.Title class="flex items-center gap-2 text-xl font-semibold">
					<Info class="h-5 w-5 text-primary" />
					System Information
				</Card.Title>
			</Card.Header>

			<Card.Content class="grid gap-6">
				<!-- Version Section -->
				<div class="space-y-4">
					<div
						class="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 transition-all hover:bg-slate-100/50 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/50"
					>
						<div class="space-y-1">
							<div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
								<Tag class="h-3 w-3" />
								Build Version
							</div>
							<div class="font-mono text-xl font-bold tracking-tight text-slate-900 dark:text-white">
								{version}
							</div>
						</div>
						{#if isDevelopment}
							<div
								class="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-500"
							>
								Development
							</div>
						{:else}
							<div
								class="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-500"
							>
								Stable
							</div>
						{/if}
					</div>

					<!-- Details Grid -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div
							class="flex flex-col gap-2 rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 transition-all hover:bg-slate-100/50 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/50"
						>
							<div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
								<GitCommit class="h-3 w-3" />
								Commit Hash
							</div>
							<a
								href={commitUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="group flex items-center gap-1.5 font-mono text-sm font-bold text-primary transition-colors hover:text-primary/80"
							>
								{commit}
								<ExternalLink class="h-3 w-3 opacity-50 group-hover:opacity-100" />
							</a>
						</div>

						<div
							class="flex flex-col gap-2 rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 transition-all hover:bg-slate-100/50 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/50"
						>
							<div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
								<ShieldCheck class="h-3 w-3" />
								Build Status
							</div>
							<div class="text-sm font-bold text-slate-900 dark:text-white">
								{isDevelopment ? 'Local Instance' : 'Production Build'}
							</div>
						</div>
					</div>
				</div>
			</Card.Content>

			<Card.Footer class="grid grid-cols-2 gap-3 pt-2">
				<Button
					variant="outline"
					class="w-full gap-2 border-slate-200/60 bg-white/50 hover:bg-slate-50 dark:border-zinc-800/60 dark:bg-zinc-950/50 dark:hover:bg-zinc-900"
					href={repo}
					target="_blank"
				>
					<SiGithub class="h-4 w-4" />
					Source
				</Button>
				<Button
					variant="outline"
					class="w-full gap-2 border-slate-200/60 bg-white/50 hover:bg-slate-50 dark:border-zinc-800/60 dark:bg-zinc-950/50 dark:hover:bg-zinc-900"
					href="https://docs.chithi.dev"
					target="_blank"
				>
					<BookOpen class="h-4 w-4" />
					Docs
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- Bottom Navigation -->
		<div class="flex flex-col items-center gap-4 text-center">
			<p class="text-sm font-medium text-slate-500 dark:text-zinc-500">
				Built with ❤️ for the privacy-conscious web.
			</p>
			<Button variant="ghost" size="sm" href="/" class="gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary">
				<Home class="h-3 w-3" />
				Back to Dashboard
			</Button>
		</div>
	</div>
</div>
