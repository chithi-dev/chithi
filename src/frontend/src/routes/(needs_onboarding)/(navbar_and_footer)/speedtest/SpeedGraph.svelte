<script lang="ts">
	import * as d3 from 'd3';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		downloadHistory = [],
		uploadHistory = [],
		downloadColor = 'var(--color-cyan-400)',
		uploadColor = 'var(--color-purple-500)',
		activePhase = null,
		currentSpeed = 0,
		currentProgress = 0,
		testDuration = 10
	} = $props<{
		downloadHistory: { progress: number; speed: number }[];
		uploadHistory: { progress: number; speed: number }[];
		maxSpeed: number;
		downloadColor: string;
		uploadColor: string;
		activePhase: 'download' | 'upload' | null;
		currentSpeed: number;
		currentProgress?: number;
		testDuration?: number;
	}>();

	const width = 800;
	const height = 240;

	// X maps progress from 0 to 1
	let xScale = $derived(d3.scaleLinear().domain([0, 1]).range([0, width]));

	// Compute a kbps-based dynamic Y domain that starts at 1 kbps
	// We assume incoming `speed` values (and `maxSpeed`, `currentSpeed`) are in Mbps
	// and convert them to kbps for axis/tick math so the axis can start at 1 kbps
	let activeDownloadHistory = $derived(
		activePhase === 'download' && currentProgress > 0
			? [
					...downloadHistory.filter(
						(d: { progress: number; speed: number }) => d.progress < currentProgress
					),
					{ progress: currentProgress, speed: currentSpeed }
				]
			: downloadHistory
	);

	let activeUploadHistory = $derived(
		activePhase === 'upload' && currentProgress > 0
			? [
					...uploadHistory.filter(
						(d: { progress: number; speed: number }) => d.progress < currentProgress
					),
					{ progress: currentProgress, speed: currentSpeed }
				]
			: uploadHistory
	);

	let maxObservedMbps = $derived(
		Math.max(
			currentSpeed || 0,
			d3.max(activeDownloadHistory, (d: { speed: number }) => d.speed) || 0,
			d3.max(activeUploadHistory, (d: { speed: number }) => d.speed) || 0
		)
	);

	// convert to kbps and ensure at least 1
	let maxObservedKbps = $derived(Math.max(1, Math.ceil(maxObservedMbps * 1000)));

	// choose a "nice" ceiling using 1-2-5 scaling (e.g. 1, 2, 5, 10, 20, 50...)
	let niceMaxKbps = $derived(
		(() => {
			const val = maxObservedKbps;
			const mag = Math.pow(10, Math.floor(Math.log10(val)));
			const norm = val / mag;
			let step;
			if (norm <= 1.0) step = 1;
			else if (norm <= 2.0) step = 2;
			else if (norm <= 5.0) step = 5;
			else step = 10;
			return step * mag;
		})()
	);

	let maxScaleTween = new Tween(1, { duration: 500, easing: cubicOut });
	$effect(() => {
		maxScaleTween.target = niceMaxKbps;
	});

	// Y maps speed (in kbps) up to the chosen nice max
	let yScale = $derived(d3.scaleLinear().domain([0, maxScaleTween.current]).range([height, 0]));

	// helper to format speeds (input in kbps)
	function formatSpeedKbps(kbps: number) {
		if (!isFinite(kbps)) return '0 kbps';
		if (kbps >= 1000) {
			const mbps = kbps / 1000;
			return mbps % 1 === 0 ? `${mbps} Mbps` : `${mbps.toFixed(1)} Mbps`;
		}
		// If the Y-axis top is very small (1 or 2 kbps), show 1 decimal place to prevent duplicated integer labels
		if (niceMaxKbps < 5 && kbps % 1 !== 0) {
			return `${kbps.toFixed(1)} kbps`;
		}
		return `${Math.round(kbps)} kbps`;
	}

	const areaGen = d3
		.area<{ progress: number; speed: number }>()
		.x((d) => xScale(d.progress))
		.y0(height)
		.y1((d) => yScale(d.speed * 1000))
		.curve(d3.curveMonotoneX);

	const lineGen = d3
		.line<{ progress: number; speed: number }>()
		.x((d) => xScale(d.progress))
		.y((d) => yScale(d.speed * 1000))
		.curve(d3.curveMonotoneX);

	let downloadArea = $derived(areaGen(activeDownloadHistory) || '');
	let downloadLine = $derived(lineGen(activeDownloadHistory) || '');
	let uploadArea = $derived(areaGen(activeUploadHistory) || '');
	let uploadLine = $derived(lineGen(activeUploadHistory) || '');

	// Define standard grids
	const xTicks = d3.range(0, 1.01, 0.05); // 20 vertical segments
	const yTicks = d3.range(0, 1.01, 0.2); // 5 horizontal segments
</script>

<div class="relative w-full overflow-hidden rounded-xl border bg-[#121212]/80 shadow-inner">
	<!-- Display Current Max Scale Top Right-->
	<div class="pointer-events-none absolute top-2 right-4 z-10 flex items-center justify-end">
		{#if activePhase}
			<span
				class="rounded bg-background/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums shadow backdrop-blur-sm"
			>
				{formatSpeedKbps(currentSpeed * 1000)}
			</span>
		{:else}
			<span
				class="rounded bg-background/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground/50 tabular-nums shadow backdrop-blur-sm"
			>
				Ready
			</span>
		{/if}
	</div>

	<!-- The Main Graph Canvas -->
	<div class="h-48 w-full md:h-64 lg:h-72">
		<svg viewBox="0 0 {width} {height}" class="block h-full w-full" preserveAspectRatio="none">
			<defs>
				<linearGradient id="dlGrad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stop-color={downloadColor} stop-opacity="0.4" />
					<stop offset="100%" stop-color={downloadColor} stop-opacity="0.0" />
				</linearGradient>
				<linearGradient id="ulGrad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stop-color={uploadColor} stop-opacity="0.4" />
					<stop offset="100%" stop-color={uploadColor} stop-opacity="0.0" />
				</linearGradient>
			</defs>

			<!-- Background Grid -->
			<g class="text-white/5 dark:text-white/10" stroke="currentColor" stroke-width="1">
				{#each xTicks as tick}
					<line x1={xScale(tick)} y1="0" x2={xScale(tick)} y2={height} />
					<!-- X-axis Label -->
					{#if (tick * testDuration) % 2 === 0 && tick > 0}
						<text
							x={xScale(tick) - 2}
							y={height - 4}
							fill="currentColor"
							stroke="none"
							font-size="10"
							text-anchor="end"
							class="font-mono text-muted-foreground/40 select-none"
						>
							{tick * testDuration}s
						</text>
					{/if}
				{/each}
				{#each yTicks as tick}
					<line x1="0" y1={tick * height} x2={width} y2={tick * height} />
					<!-- Y-axis Label -->
					{#if tick < 1}
						<text
							x={width - 4}
							y={tick * height - 4}
							fill="currentColor"
							stroke="none"
							font-size="10"
							text-anchor="end"
							class="font-mono text-muted-foreground/40 select-none"
						>
							{formatSpeedKbps(niceMaxKbps - tick * niceMaxKbps)}
						</text>
					{/if}
				{/each}
				<!-- Grid Base Line Top -->
				<line
					x1="0"
					y1="0"
					x2={width}
					y2="0"
					stroke="currentColor"
					stroke-width="2"
					class="text-white/10 dark:text-white/20"
				/>
			</g>

			<!-- Download Timeline -->
			{#if activeDownloadHistory.length > 0}
				<path d={downloadArea} fill="url(#dlGrad)" />
				<path d={downloadLine} fill="none" stroke={downloadColor} stroke-width="2" />
			{/if}

			<!-- Upload Timeline Overlay -->
			{#if activeUploadHistory.length > 0}
				<path d={uploadArea} fill="url(#ulGrad)" />
				<path
					d={uploadLine}
					fill="none"
					stroke={uploadColor}
					stroke-width="2"
					stroke-dasharray="4 4"
				/>
			{/if}
		</svg>
	</div>
</div>
