<script lang="ts">
	import { PieChart, Text } from 'layerchart';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		value = 0,
		activeColor = '#4ade80',
		unit = 'Mbps'
	} = $props<{
		value: number;
		activeColor: string;
		unit?: string;
	}>();

	// Dynamic scale milestones
	const scaleSteps = [100, 1000, 2500, 5000, 10_000, 20_000, 30_000, 40_000];
	let targetMax = $derived(
		scaleSteps.find((step) => step > value * 1.05) || scaleSteps[scaleSteps.length - 1]
	);

	// Smooth maximum expansion
	let maxTween = $state(new Tween(100, { duration: 1000, easing: cubicOut }));

	$effect(() => {
		if (value === 0 && maxTween.current !== 100) {
			maxTween.set(100, { duration: 0 }); // snap back immediately on reset
		} else {
			maxTween.target = targetMax;
		}
	});

	let displayValue = $derived(Math.min(value, maxTween.current));
	let remainingValue = $derived(Math.max(0, maxTween.current - displayValue));
</script>

<div class="relative flex aspect-square w-full flex-col items-center justify-center p-2">
	<!-- Reusing layerchart for a perfect high-end aesthetic -->
	<PieChart
		data={[
			{ key: 'value', value: displayValue, color: activeColor },
			{
				key: 'remaining',
				value: remainingValue,
				color: `color-mix(in srgb, ${activeColor} 15%, transparent)`
			}
		]}
		key="key"
		value="value"
		c="color"
		innerRadius={0.88}
		padding={0}
		range={[-135, 135]}
		props={{ pie: { sort: null } }}
		cornerRadius={12}
	>
		{#snippet aboveMarks()}
			<Text
				value={String(value.toFixed(1))}
				textAnchor="middle"
				verticalAnchor="middle"
				class="fill-foreground text-3xl font-medium tabular-nums lg:text-4xl"
				dy={-5}
			/>
			<Text
				value={unit}
				textAnchor="middle"
				verticalAnchor="middle"
				class="fill-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
				dy={25}
			/>
			<!-- Subtle max indicator for the dynamic scale -->
			<Text
				value={`Scale ${targetMax}`}
				textAnchor="middle"
				verticalAnchor="middle"
				class="fill-muted-foreground/30 text-[9px] font-medium uppercase"
				dy={45}
			/>
		{/snippet}
	</PieChart>
</div>
