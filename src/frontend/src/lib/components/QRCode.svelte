<script lang="ts">
	import { cn } from '$lib/utils';
	import { renderSVG } from 'uqr';

	interface Props {
		value: string;
		size?: number;
		color?: string;
		backgroundColor?: string;
		class?: string;
	}

	let {
		value,
		size = 200,
		color = '#000000',
		backgroundColor = '#ffffff',
		class: klass
	}: Props = $props();

	let svgMarkup = $state('');

	$effect(() => {
		const svg = renderSVG(value, {
			border: 1,
			pixelSize: 1,
			blackColor: color,
			whiteColor: backgroundColor
		});

		if (klass) {
			const safeClass = klass.replace(/"/g, '&quot;');
			svgMarkup = svg.replace('<svg', `<svg class="${safeClass}"`);
			return;
		}

		svgMarkup = svg;
	});
</script>

<div
	class={cn(
		`qr-code grid h-fit w-fit`,
		// Prevent right-click save on the rendered SVG by overlaying a transparent layer.
		`after:col-start-1 after:row-start-1 after:h-full after:w-full after:content-['']`
	)}
	style={`width: ${size}px; height: ${size}px;`}
>
	{@html svgMarkup}
</div>

<style>
	.qr-code :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
