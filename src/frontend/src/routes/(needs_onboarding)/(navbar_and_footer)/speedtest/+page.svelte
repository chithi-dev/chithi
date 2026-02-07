<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { BACKEND_API } from '#consts/backend';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { PieChart, Text } from 'layerchart';
	import { Play, RotateCw, Activity, ArrowDown, ArrowUp, Timer } from 'lucide-svelte';
	import SpeedtestWorker from '$lib/workers/speedtest.worker?worker';
	import { cn } from '$lib/utils';
	import { Progress } from '$lib/components/ui/progress';

	let worker: Worker | undefined;
	let status = $state<'idle' | 'downloading' | 'uploading' | 'finished' | 'error' | 'starting'>(
		'idle'
	);
	let downloadSpeed = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let uploadSpeed = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let progress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let errorMsg = $state('');

	let maxSpeed = $state(100); // Dynamic scale for the gauge
	let testDuration = $state(10);

	function startTest() {
		if (worker) worker.terminate();
		worker = new SpeedtestWorker();

		status = 'starting';
		downloadSpeed = new Tween(0, { duration: 500, easing: cubicOut });
		uploadSpeed = new Tween(0, { duration: 500, easing: cubicOut });
		progress = new Tween(0, { duration: 500, easing: cubicOut });
		errorMsg = '';
		maxSpeed = 100;

		worker.onmessage = (e) => {
			const { type } = e.data;
			if (type === 'phase') {
				if (e.data.phase === 'download') status = 'downloading';
				if (e.data.phase === 'upload') status = 'uploading';
				progress = new Tween(0, { duration: 500, easing: cubicOut });
			} else if (type === 'progress') {
				progress.target = e.data.progress * 100;
				const currentSpeed = e.data.speed;

				if (e.data.phase === 'download') downloadSpeed.target = currentSpeed;
				if (e.data.phase === 'upload') uploadSpeed.target = currentSpeed;

				// Adjust gauge scale if speed exceeds current max (with hysteresis)
				if (currentSpeed > maxSpeed * 0.9) {
					maxSpeed = Math.max(maxSpeed * 2, Math.ceil(currentSpeed / 100) * 100 * 1.5);
				}
			} else if (type === 'result') {
				if (e.data.key === 'download') downloadSpeed.target = e.data.value;
				if (e.data.key === 'upload') uploadSpeed.target = e.data.value;
			} else if (type === 'finish') {
				status = 'finished';
				progress.target = 100;
			} else if (type === 'error') {
				status = 'error';
				errorMsg = e.data.error;
			}
		};

		worker.postMessage({ type: 'start', baseUrl: BACKEND_API, duration: testDuration });
	}

	onDestroy(() => {
		if (worker) worker.terminate();
	});

	// Chart Config - using shadcn CSS variables
	const chartConfig = {
		download: { label: 'Download', color: 'var(--color-cyan-400)' },
		upload: { label: 'Upload', color: 'var(--color-purple-500)' },
		remaining: { label: 'Remaining', color: 'rgb(0 0 0 / 0.1)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="flex h-full w-full flex-col justify-center">
	<Card class="mx-auto w-full border-border bg-card transition-all duration-200">
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle class="flex items-center gap-2 text-2xl">
						<Activity class="h-6 w-6 text-primary" /> Speedtest
					</CardTitle>
					<CardDescription>Check your internet connection speed to the server.</CardDescription>
				</div>
				<div class="flex h-6 flex-col justify-center">
					<div
						class={cn(
							'flex items-center gap-2 transition-opacity duration-200',
							status === 'idle' || status === 'error' ? 'opacity-0' : 'opacity-100'
						)}
					>
						{#if status === 'finished'}
							<span class="text-sm font-medium uppercase tracking-wider text-green-500">
								Test Complete
							</span>
						{:else}
							<span class="animate-pulse text-sm font-medium uppercase tracking-wider text-muted-foreground">
								{status}...
							</span>
						{/if}
					</div>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-8 py-4">
			<!-- Gauges Container -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Download Gauge -->
				<div
					class="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 p-6 transition-colors"
				>
					<div class="flex items-center gap-2 font-semibold text-foreground">
						<ArrowDown class="h-4 w-4 text-cyan-400" />
						Download Speed
					</div>
					<div class="relative h-56 w-56">
						<!-- Always render the gauge, just update the value -->
						{@render RadialGauge(
							downloadSpeed.current,
							maxSpeed,
							chartConfig.download.color
						)}
					</div>
				</div>

				<!-- Upload Gauge -->
				<div
					class="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 p-6 transition-colors"
				>
					<div class="flex items-center gap-2 font-semibold text-foreground">
						<ArrowUp class="h-4 w-4 text-purple-500" />
						Upload Speed
					</div>
					<div class="relative h-56 w-56">
						{@render RadialGauge( uploadSpeed.current, maxSpeed, chartConfig.upload.color)}
					</div>
				</div>
			</div>

			<!-- Status Area (Fixed Height to prevent layout shift) -->
			<div class="relative h-14 w-full">
				<!-- Progress Bar -->
				<div
					class={cn(
						'absolute inset-0 flex flex-col justify-center space-y-2 transition-all duration-300',
						status === 'downloading' || status === 'uploading' || status === 'starting'
							? 'translate-y-0 opacity-100'
							: 'pointer-events-none translate-y-2 opacity-0'
					)}
				>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>Progress</span>
						<span>{Math.round(progress.current)}%</span>
					</div>
					<Progress value={progress.current} class="h-2" />
				</div>

				<!-- Error Message -->
				<div
					class={cn(
						'absolute inset-0 flex items-center justify-center rounded-md border border-destructive/50 bg-destructive/10 text-center text-sm text-destructive transition-all duration-300',
						status === 'error'
							? 'translate-y-0 opacity-100'
							: 'pointer-events-none translate-y-2 opacity-0'
					)}
				>
					Error: {errorMsg}
				</div>
			</div>

			<Separator />

			<!-- Settings -->
			<div class="flex flex-col items-center justify-center gap-6 pt-2">
				<div class="flex w-full max-w-sm items-end gap-4">
					<div class="grid w-full gap-1.5">
						<Label for="duration" class="flex items-center gap-2 text-muted-foreground">
							<Timer class="h-4 w-4" />
							Test Duration (seconds)
						</Label>
						<Input
							type="number"
							id="duration"
							bind:value={testDuration}
							min={5}
							max={60}
							disabled={status !== 'idle' && status !== 'finished' && status !== 'error'}
						/>
					</div>
				</div>
			</div>
		</CardContent>
		<CardFooter class="flex justify-center pb-8 pt-4">
			{#if status === 'idle' || status === 'finished' || status === 'error'}
				<Button
					size="lg"
					onclick={startTest}
					class="w-48 gap-2 text-lg font-semibold shadow-lg transition-all hover:scale-105 active:scale-95"
				>
					<Play class="h-5 w-5" /> Start Test
				</Button>
			{:else}
				<Button size="lg" variant="outline" disabled class="w-48 gap-2">
					<RotateCw class="h-5 w-5 animate-spin" /> Testing...
				</Button>
			{/if}
		</CardFooter>
	</Card>
</div>

{#snippet RadialGauge( value: number, max: number, activeColor: string)}
	<Chart.Container config={chartConfig} class="mx-auto aspect-square w-full">
		<PieChart
			data={[
				{ key: 'value', value: value, color: activeColor },
				{
					key: 'remaining',
					value: Math.max(0, max - value),
					color: chartConfig.remaining.color
				}
			]}
			key="key"
			value="value"
			c="color"
			innerRadius={0.75}
			padding={0}
			range={[-90, 90]}
			props={{ pie: { sort: null } }}
			cornerRadius={10}
		>
			{#snippet aboveMarks()}
				<Text
					value={String(value.toFixed(1))}
					textAnchor="middle"
					verticalAnchor="middle"
					class="fill-foreground text-4xl font-bold"
					dy={-20}
				/>
				<Text
					value="Mbps"
					textAnchor="middle"
					verticalAnchor="middle"
					class="fill-muted-foreground text-sm font-medium"
					dy={15}
				/>
			{/snippet}
		</PieChart>
	</Chart.Container>
{/snippet}
