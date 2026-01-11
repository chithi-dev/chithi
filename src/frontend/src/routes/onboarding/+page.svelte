<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { useOnboarding } from '$lib/queries/onboarding';

	// Steps
	import Step1 from './1.svelte';
	import Step2 from './2.svelte';

	let step = $state(1);

	function nextStep() {
		if (step === 1) {
			step = 2;
		} else {
			goto('/');
		}
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 transition-colors duration-500 dark:bg-zinc-950"
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
		{#if step === 1}
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
