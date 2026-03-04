<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { useOnboarding } from '#queries/onboarding';
	import * as Card from '$lib/components/ui/card';
	import { Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';

	// Steps
	import Step1 from './1.svelte';
	import Step2 from './2.svelte';

	const { status } = useOnboarding();

	$effect(() => {
		if (!status.isLoading) {
			step = 1;
		}
	});
	let step = $state<null | number>(null);

	function nextStep() {
		if (step === 1) {
			step = 2;
		} else {
			goto('/');
		}
	}
</script>

<div
	class="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
>
	<!-- Detailed Background Elements -->
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

	<!-- Step Content Container -->
	<div class="z-10 w-full max-w-100 transition-all duration-500 {step === 2 ? 'max-w-xl' : ''}">
		{#if status.isLoading}
			<div class="mx-auto w-full max-w-md">
				<Card.Root
					class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
				>
					<div
						class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
					></div>

					<Card.Header class="space-y-3 pt-10 pb-6 text-center">
						<Skeleton class="mx-auto mb-2 h-14 w-14 rounded-2xl" />
						<div class="space-y-1">
							<Skeleton class="mx-auto mb-2 h-6 w-48" />
							<Skeleton class="mx-auto h-4 w-64" />
						</div>
					</Card.Header>

					<Card.Content>
						<div class="grid gap-4">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-3/4" />
							<Skeleton class="h-12 w-full rounded-md" />
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else if status.data?.onboarded}
			<div in:fade class="mx-auto w-full max-w-md">
				<Card.Root
					class="relative overflow-hidden border-slate-200/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-900/50"
				>
					<div
						class="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-primary/40 to-transparent"
					></div>

					<Card.Header class="space-y-3 pt-10 pb-6 text-center">
						<div
							class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-green-100 bg-green-50 text-green-600 shadow-sm ring-1 ring-green-200 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"
						>
							<Check class="size-8" />
						</div>
						<div class="space-y-1">
							<Card.Title
								class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
								>Already Onboarded</Card.Title
							>
							<Card.Description class="text-sm text-slate-500 dark:text-zinc-400"
								>This instance has already been set up. You can go to the dashboard to continue.</Card.Description
							>
						</div>
					</Card.Header>

					<Card.Content>
						<div class="grid gap-4">
							<p class="text-center text-sm text-slate-600 dark:text-zinc-400">
								If you need to reconfigure, sign in and adjust settings from the dashboard.
							</p>
							<Button class="mt-2 h-12 w-full" onclick={() => goto('/')}>Go to dashboard</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else if step === 1}
			<div
				in:fly={{ x: -20, duration: 400, delay: 200 }}
				out:fade={{ duration: 200 }}
				class="absolute inset-0 m-auto h-fit w-full max-w-100 p-4"
			>
				<Step1 onNext={nextStep} />
			</div>
		{:else if step === 2}
			<div in:fly={{ x: 20, duration: 400, delay: 200 }} class="relative w-full">
				<Step2 onNext={nextStep} />
			</div>
		{/if}
	</div>
</div>
