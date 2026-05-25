<svelte:options css="injected" />

<script lang="ts">
	import logo from '$lib/assets/logo.svg?raw';

	let {
		displayDomain = '',
		domainDirection = 'ltr',
		label,
		title,
		subtitle,
		footerTags = ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge']
	} = $props<{
		displayDomain?: string;
		domainDirection?: 'ltr' | 'rtl';
		label: string;
		title: string;
		subtitle: string;
		footerTags?: string[];
	}>();
</script>

<div
	class="dark relative flex h-157.5 w-300 flex-col justify-center overflow-hidden bg-background px-24 py-16 font-[Geist,sans-serif]"
>
	<!-- Background Ambient Glows -->
	<div
		class="absolute -top-50 -left-50 flex h-150 w-150 rounded-full bg-rose-600/20 blur-[100px]"
	></div>
	<div
		class="absolute -right-50 -bottom-50 flex h-150 w-150 rounded-full bg-fuchsia-700/15 blur-[120px]"
	></div>

	<!-- Domain Header -->
	<div
		dir={domainDirection}
		class={[
			'pt-6 text-2xl font-semibold text-gray-400',
			{ 'text-right': domainDirection === 'rtl', 'text-left': domainDirection !== 'rtl' }
		]}
	>
		{displayDomain}
	</div>

	<!-- Main Content Row -->
	<div class="relative z-20 flex flex-1 flex-row items-center">
		<!-- Logo Box (UNMASKED) -->
		<div
			class="flex h-60 w-60 shrink-0 items-center justify-center rounded-[52px] border-4 border-rose-500/30 bg-card shadow-[0_0_80px_rgba(244,63,94,0.15)]"
		>
			<div class="flex h-30 w-30 items-center justify-center">
				{@html logo}
			</div>
		</div>

		<!-- Text Content -->
		<div class="ml-16 flex flex-col">
			<p class="m-0 mb-4 text-[20px] font-bold tracking-[0.25em] text-rose-400 uppercase">
				{label}
			</p>

			<!-- Title with Dynamic One-Sided Cutoff Gradient -->
			<h1
				class="m-0 mb-4 text-[88px] leading-none font-extrabold tracking-tight text-foreground mask-[linear-gradient(to_right,#000_85%,transparent_100%)]"
			>
				{title}
			</h1>

			<p class="m-0 text-[34px] leading-[1.35] font-medium text-muted-foreground">
				{subtitle}
			</p>
		</div>
	</div>

	<!-- Footer Tags (UNMASKED) -->
	<div class="relative z-20 mt-12 flex flex-row">
		{#each footerTags as tag, i}
			<div
				class={[
					'flex items-center justify-center rounded-full border border-solid border-rose-400/30 bg-rose-400/10 px-6 py-3',
					{ 'mr-6': i < footerTags.length - 1 }
				]}
			>
				<span class="text-[20px] font-semibold text-rose-200">{tag}</span>
			</div>
		{/each}
	</div>
</div>
