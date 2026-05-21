<svelte:options css="injected" />

<script lang="ts">
	import logo from '$lib/assets/logo.svg?raw';

	let {
		domain,
		label,
		title,
		subtitle,
		footerTags = ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge']
	} = $props<{
		domain?: string;
		label: string;
		title: string;
		subtitle: string;
		footerTags?: string[];
	}>();

	const RTL_CHARACTERS = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
	const displayDomain = $derived(domain?.trim() || '');
	const isRtl = $derived(RTL_CHARACTERS.test(`${label} ${title} ${subtitle}`));
	const direction = $derived(isRtl ? 'rtl' : 'ltr');
	const domainAlignClass = $derived(isRtl ? 'ml-auto text-right' : 'mr-auto text-left');
</script>

<div
	class="relative flex h-157.5 w-300 flex-col justify-center overflow-hidden bg-[#040507] px-24 py-16 font-[Geist,sans-serif]"
>
	<!-- Background Ambient Glows -->
	<div
		class="absolute -top-50 -left-50 flex h-150 w-150 rounded-full bg-[rgba(232,34,48,0.2)] blur-[100px]"
	></div>
	<div
		class="absolute -right-50 -bottom-50 flex h-150 w-150 rounded-full bg-[rgba(214,16,179,0.15)] blur-[120px]"
	></div>
	<div class="absolute top-10 right-24 left-24 z-10 flex">
		<div
			class={`flex items-center text-[20px] font-semibold text-[#e5e7eb] ${domainAlignClass}`}
			dir={direction}
		>
			{displayDomain}
		</div>
	</div>

	<!-- Main Content Row -->
	<div class="relative z-10 flex flex-row items-center">
		<!-- Logo Box -->
		<div
			class="flex h-60 w-60 shrink-0 items-center justify-center rounded-[52px] border-4 border-[rgba(255,45,85,0.3)] bg-[#0a0d14] shadow-[0_0_80px_rgba(255,45,85,0.15)]"
		>
			<div class="flex h-30 w-30 items-center justify-center">
				{@html logo}
			</div>
		</div>

		<!-- Text Content -->
		<div class="ml-16 flex flex-col">
			<p class="m-0 mb-4 text-[20px] font-bold tracking-[0.25em] text-[#fb7185] uppercase">
				{label}
			</p>
			<h1 class="m-0 mb-4 text-[88px] leading-none font-extrabold tracking-tight text-white">
				{title}
			</h1>
			<p class="m-0 text-[34px] leading-[1.35] font-medium text-[#9ca3af]">
				{subtitle}
			</p>
		</div>
	</div>

	<!-- Footer Tags -->
	<div class="relative z-10 mt-14 flex flex-row">
		{#each footerTags as tag, i}
			<div
				class="flex items-center justify-center rounded-full border border-solid border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-6 py-3 {i <
				footerTags.length - 1
					? 'mr-6'
					: ''}"
			>
				<span class="text-[20px] font-semibold text-[#fecdd3]">{tag}</span>
			</div>
		{/each}
	</div>
</div>
