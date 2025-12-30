<script lang="ts">
	import QRCode from 'qrcode';

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
		class: className
	}: Props = $props();

	let canvas = $state<null | HTMLCanvasElement>(null);

	$effect(() => {
		if (canvas) {
			QRCode.toCanvas(
				canvas,
				value,
				{
					width: size,
					margin: 1,
					color: {
						dark: color,
						light: backgroundColor
					}
				},
				(error) => {
					if (error) console.error(error);
				}
			);
		}
	});
</script>

<canvas bind:this={canvas} class={className}></canvas>
