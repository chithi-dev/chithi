<script lang="ts">
	import * as d3 from 'd3';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		downloadHistory = [],
		uploadHistory = [],
		downloadColor = 'hsl(var(--primary))',
		uploadColor = 'hsl(var(--secondary))',
		activePhase = null,
		currentSpeed = 0,
		currentProgress = 0,
		testDuration = 10
	} = $props<{
		downloadHistory: { progress: number; speed: number }[];
		uploadHistory: { progress: number; speed: number }[];
		maxSpeed: number;
		downloadColor?: string;
		uploadColor?: string;
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

	let svgNode: SVGSVGElement | null = $state(null);

	$effect(() => {
		if (!svgNode) return;
		const svg = d3.select(svgNode);

		var applyAttrs = (sel: any, attrs: Record<string, any>) =>
			Object.entries(attrs).forEach(([k, v]) => sel.attr(k, v));

		// Gradients
		const defs = svg.selectAll('defs').data([0]).join('defs');
		[
			['dlGrad', downloadColor],
			['ulGrad', uploadColor]
		].forEach(([id, color]) => {
			defs
				.selectAll(`linearGradient#${id}`)
				.data([0])
				.join('linearGradient')
				.call(applyAttrs, { id, x1: '0%', y1: '0%', x2: '0%', y2: '100%' })
				.selectAll('stop')
				.data(['0.4', '0.0'])
				.join('stop')
				.call(applyAttrs, {
					offset: (d: string, i: number) => (i ? '100%' : '0%'),
					'stop-color': color,
					'stop-opacity': String
				});
		});

		// Base Grid
		const grid = svg.selectAll('g.bg-grid').data([0]).join('g').call(applyAttrs, {
			class: 'bg-grid text-border',
			stroke: 'currentColor',
			'stroke-width': '1'
		});

		grid
			.selectAll('line.x-tick')
			.data(xTicks)
			.join('line')
			.call(applyAttrs, { class: 'x-tick', x1: xScale, y1: 0, x2: xScale, y2: height });
		grid
			.selectAll('text.x-label')
			.data(xTicks.filter((t) => (t * testDuration) % 2 === 0 && t > 0))
			.join('text')
			.text((d) => `${d * testDuration}s`)
			.call(applyAttrs, {
				class: 'x-label font-mono text-muted-foreground select-none',
				x: (d: number) => xScale(d) - 2,
				y: height - 4,
				fill: 'currentColor',
				stroke: 'none',
				'font-size': '10',
				'text-anchor': 'end'
			});

		grid
			.selectAll('line.y-tick')
			.data(yTicks)
			.join('line')
			.call(applyAttrs, {
				class: 'y-tick',
				x1: 0,
				y1: (d: number) => d * height,
				x2: width,
				y2: (d: number) => d * height
			});
		grid
			.selectAll('text.y-label')
			.data(yTicks.filter((t) => t < 1))
			.join('text')
			.text((d) => formatSpeedKbps(niceMaxKbps - d * niceMaxKbps))
			.call(applyAttrs, {
				class: 'y-label font-mono text-muted-foreground select-none',
				x: width - 4,
				y: (d: number) => d * height - 4,
				fill: 'currentColor',
				stroke: 'none',
				'font-size': '10',
				'text-anchor': 'end'
			});

		grid.selectAll('line.base-line').data([0]).join('line').call(applyAttrs, {
			class: 'base-line text-border',
			x1: 0,
			y1: 0,
			x2: width,
			y2: 0,
			stroke: 'currentColor',
			'stroke-width': '2'
		});

		// Timelines
		var draw = (
			type: string,
			active: boolean,
			area: string,
			line: string,
			color: string,
			dash?: string | null
		) => {
			svg
				.selectAll(`path.${type}-area`)
				.data(active ? [area] : [])
				.join('path')
				.call(applyAttrs, { class: `${type}-area`, d: String, fill: `url(#${type}Grad)` });
			svg
				.selectAll(`path.${type}-line`)
				.data(active ? [line] : [])
				.join('path')
				.call(applyAttrs, {
					class: `${type}-line`,
					d: String,
					fill: 'none',
					stroke: color,
					'stroke-width': '2',
					'stroke-dasharray': dash || null
				});
		};

		draw('dl', activeDownloadHistory.length > 0, downloadArea, downloadLine, downloadColor);
		draw('ul', activeUploadHistory.length > 0, uploadArea, uploadLine, uploadColor, '4 4');
	});
</script>

<div class="relative w-full overflow-hidden rounded-xl border bg-muted/30 shadow-inner">
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
		<svg
			viewBox="0 0 {width} {height}"
			class="block h-full w-full"
			preserveAspectRatio="none"
			bind:this={svgNode}
		></svg>
	</div>
</div>
