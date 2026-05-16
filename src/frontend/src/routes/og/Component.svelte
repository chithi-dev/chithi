<svelte:options css="injected" />

<script lang="ts">
	let { title, description } = $props<{
		title?: string | null;
		description?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'Chithi').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() ||
			'Encrypted file sharing with end-to-end privacy and auto-expiring links'
		).slice(0, 90)
	);
</script>

<div
	class="relative flex h-157.5 w-300 flex-col justify-center overflow-hidden bg-[#040507] px-24 py-16 font-[Geist,sans-serif]"
>
	<!-- Background Ambient Glows -->
	<div
		class="absolute -top-50 -left-[200px] flex h-[600px] w-[600px] rounded-full bg-[rgba(232,34,48,0.2)] blur-[100px]"
	></div>
	<div
		class="absolute -right-[200px] -bottom-[200px] flex h-[600px] w-[600px] rounded-full bg-[rgba(214,16,179,0.15)] blur-[120px]"
	></div>

	<!-- Main Content Row -->
	<div class="relative z-10 flex flex-row items-center">
		<!-- Logo Box -->
		<div
			class="flex h-[240px] w-[240px] shrink-0 items-center justify-center rounded-[52px] border-4 border-[rgba(255,45,85,0.3)] bg-[#0a0d14] shadow-[0_0_80px_rgba(255,45,85,0.15)]"
		>
			<svg
				class="h-[120px] w-[120px]"
				width="130"
				height="130"
				viewBox="0 0 130 130"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect
					x="2.5"
					y="2.5"
					width="125"
					height="125"
					rx="21.5"
					stroke="url(#logo-border)"
					stroke-width="5"
				/>
				<path
					d="M81.0417 62.7083H48.9583C46.427 62.7083 44.375 64.7604 44.375 67.2917V83.3333C44.375 85.8646 46.427 87.9167 48.9583 87.9167H81.0417C83.573 87.9167 85.625 85.8646 85.625 83.3333V67.2917C85.625 64.7604 83.573 62.7083 81.0417 62.7083Z"
					stroke="url(#logo-lock)"
					stroke-width="6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M53.5417 62.7083V53.5417C53.5417 50.5027 54.7489 47.5883 56.8977 45.4394C59.0466 43.2905 61.9611 42.0833 65 42.0833C68.0389 42.0833 70.9534 43.2905 73.1023 45.4394C75.2511 47.5883 76.4583 50.5027 76.4583 53.5417V62.7083"
					stroke="url(#logo-lock)"
					stroke-width="6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<defs>
					<linearGradient
						id="logo-border"
						x1="125"
						y1="65.2963"
						x2="5"
						y2="64.7037"
						gradientUnits="userSpaceOnUse"
					>
						<stop stop-color="#E20505" />
						<stop offset="1" stop-color="#E90F13" />
					</linearGradient>
					<linearGradient
						id="logo-lock"
						x1="65"
						y1="42.0833"
						x2="65"
						y2="87.9167"
						gradientUnits="userSpaceOnUse"
					>
						<stop stop-color="#F70606" />
						<stop offset="0.9999" stop-color="#D410B3" />
					</linearGradient>
				</defs>
			</svg>
		</div>

		<!-- Text Content -->
		<div class="ml-16 flex flex-col">
			<p class="m-0 mb-4 text-[20px] font-bold tracking-[0.25em] text-[#fb7185] uppercase">
				Private by design
			</p>
			<h1 class="m-0 mb-4 text-[88px] leading-[1] font-extrabold tracking-tight text-white">
				{displayTitle}
			</h1>
			<p class="m-0 text-[34px] leading-[1.35] font-medium text-[#9ca3af]">
				{displayDescription}
			</p>
		</div>
	</div>

	<!-- Footer Tags -->
	<div class="relative z-10 mt-14 flex flex-row">
		<div
			class="mr-6 flex items-center justify-center rounded-full border border-solid border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-6 py-3"
		>
			<span class="text-[20px] font-semibold text-[#fecdd3]">End-to-end encryption</span>
		</div>
		<div
			class="mr-6 flex items-center justify-center rounded-full border border-solid border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-6 py-3"
		>
			<span class="text-[20px] font-semibold text-[#fecdd3]">Auto-expiring links</span>
		</div>
		<div
			class="flex items-center justify-center rounded-full border border-solid border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] px-6 py-3"
		>
			<span class="text-[20px] font-semibold text-[#fecdd3]">Zero-knowledge transfer</span>
		</div>
	</div>
</div>
