<script lang="ts">
	let { children } = $props();
</script>

<main class="relative flex flex-1 items-center justify-center overflow-hidden p-4">
	<div class="absolute inset-0 z-0 overflow-hidden bg-slate-50 dark:bg-zinc-950">
		<!-- Rotating Beams -->
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_50s_linear_infinite_reverse] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_180deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>

		<!-- Blobs -->
		<div
			class="absolute -top-[20%] -left-[20%] h-160 w-160 animate-blob rounded-full bg-purple-300/40 mix-blend-multiply blur-[100px] filter dark:bg-purple-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute top-[10%] -right-[20%] h-140 w-140 animate-blob rounded-full bg-yellow-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:2s] dark:bg-indigo-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute -bottom-[20%] left-[20%] h-180 w-180 animate-blob rounded-full bg-pink-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:4s] dark:bg-blue-900/40 dark:mix-blend-hard-light"
		></div>

		<!-- Grid with Pulse -->
		<div
			class="absolute inset-0 animate-pulse-slow bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"
		></div>

		<!-- Floating Particles & Stars -->
		<div class="absolute inset-0 overflow-hidden">
			<div
				class="absolute top-[20%] left-[10%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="absolute top-[60%] right-[15%] h-3 w-3 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[10%] left-[30%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[30%] right-[40%] h-1.5 w-1.5 animate-float rounded-full bg-primary/30 blur-[1px] [animation-delay:5s]"
			></div>

			<!-- Twinkling Stars -->
			<div
				class="absolute top-[15%] left-[25%] h-1 w-1 animate-twinkle rounded-full bg-yellow-200/60 blur-[0.5px]"
			></div>
			<div
				class="absolute top-[35%] right-[25%] h-1.5 w-1.5 animate-twinkle rounded-full bg-blue-200/60 blur-[0.5px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[25%] left-[45%] h-1 w-1 animate-twinkle rounded-full bg-purple-200/60 blur-[0.5px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[10%] right-[10%] h-0.5 w-0.5 animate-twinkle rounded-full bg-white/60 blur-[0.5px] [animation-delay:5s]"
			></div>
		</div>

		<!-- Noise Overlay -->
		<div class="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay">
			<svg class="h-full w-full">
				<filter id="noise">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.8"
						numOctaves="3"
						stitchTiles="stitch"
					/>
				</filter>
				<rect width="100%" height="100%" filter="url(#noise)" />
			</svg>
		</div>

		<!-- Vignette -->
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-slate-50)_100%)] opacity-60 dark:bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-zinc-950)_100%)]"
		></div>
	</div>

	<div class="relative z-10 w-full max-w-5xl shadow-[0_0_15px_-12px_var(--primary)]">
		{@render children()}
	</div>
</main>
