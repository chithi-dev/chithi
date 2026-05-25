<svelte:options css="injected" />

<script lang="ts">
	import logo from '$lib/assets/logo.svg?raw';
	import { ShieldCheck, ShieldOff } from '@lucide/svelte';
	import { OgDirection, OgSecurity } from './og-enums';

	let {
		displayDomain = '',
		domainDirection = OgDirection.Ltr,
		domainSecurity,
		label,
		title,
		subtitle,
		footerTags = ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge']
	} = $props<{
		displayDomain?: string;
		domainDirection?: OgDirection;
		domainSecurity: OgSecurity;
		label: string;
		title: string;
		subtitle: string;
		footerTags?: string[];
	}>();
</script>

<div
	class="dark flex h-157.5 w-300 flex-col justify-center overflow-hidden bg-background bg-[radial-gradient(circle_at_15%_0%,rgba(244,63,94,0.14),transparent_62%),radial-gradient(circle_at_90%_100%,rgba(217,70,239,0.12),transparent_68%)] px-24 py-16 font-[Geist,sans-serif]"
>
	<!-- Domain Header -->
	<div
		dir={domainDirection}
		class={[
			'flex items-center gap-3 pt-6 text-2xl font-semibold text-gray-400',
			{
				'text-right': domainDirection === OgDirection.Rtl,
				'text-left': domainDirection !== OgDirection.Rtl
			}
		]}
	>
		{#if domainSecurity === OgSecurity.Secure}
			<ShieldCheck class="h-5 w-5 text-emerald-400" />
		{:else}
			<ShieldOff class="h-5 w-5 text-gray-400" />
		{/if}
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
