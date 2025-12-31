<script lang="ts">
	import { cn } from '$lib/utils';
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
		class: klass
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

<!-- I dont like the fact that canvas is a image and people can right click canvas to get the image  -->
<!-- So i am making the canvas unclickable using the same technique facebook/instagram uses  -->
<div
	class="grid h-fit w-fit after:col-start-1 after:row-start-1 after:h-full after:w-full after:content-['']"
>
	<canvas bind:this={canvas} class={cn(klass, 'col-start-1 row-start-1')}></canvas>
</div>
