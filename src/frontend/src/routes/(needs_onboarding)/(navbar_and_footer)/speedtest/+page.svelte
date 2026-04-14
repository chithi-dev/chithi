<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
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
	import { Play, RotateCw, Activity, ArrowDown, ArrowUp, Timer } from 'lucide-svelte';
	import { Api } from '#consts/backend';
	import SpeedtestWorker from './speedtest.worker?worker';
	import SpeedGauge from './SpeedGauge.svelte';
	import SpeedGraph from './SpeedGraph.svelte';

	let worker: Worker | undefined;
	let status = $state<
		'idle' | 'measuring latency' | 'downloading' | 'uploading' | 'finished' | 'error' | 'starting'
	>('idle');
	let latency = $state(new Tween(0, { duration: 300, easing: cubicOut }));
	let downloadSpeed = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let uploadSpeed = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let progress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let errorMsg = $state('');

	let downloadHistory = $state<{ progress: number; speed: number }[]>([]);
	let uploadHistory = $state<{ progress: number; speed: number }[]>([]);

	let maxSpeed = $state(100); // Dynamic scale for the gauge
	let testDuration = $state(10);

	function startTest() {
		if (worker) worker.terminate();
		worker = new SpeedtestWorker();

		status = 'starting';
		latency.set(0, { duration: 0 });
		downloadSpeed.set(0, { duration: 0 });
		uploadSpeed.set(0, { duration: 0 });
		progress.set(0, { duration: 0 });
		downloadHistory = [];
		uploadHistory = [];
		errorMsg = '';
		maxSpeed = 100;

		worker.onmessage = (e) => {
			const { type } = e.data;
			if (type === 'phase') {
				if (e.data.phase === 'latency') status = 'measuring latency';
				if (e.data.phase === 'download') status = 'downloading';
				if (e.data.phase === 'upload') status = 'uploading';
				progress = new Tween(0, { duration: 500, easing: cubicOut });
			} else if (type === 'progress') {
				progress.target = e.data.progress * 100;
				const currentSpeed = e.data.speed; // speed maps to value

				if (e.data.phase === 'latency') latency.target = currentSpeed;
				if (e.data.phase === 'download') {
					downloadSpeed.target = currentSpeed;
					downloadHistory.push({ progress: e.data.progress, speed: currentSpeed });
					if (currentSpeed > maxSpeed * 0.9) {
						maxSpeed = Math.max(maxSpeed * 2, Math.ceil(currentSpeed / 100) * 100 * 1.5);
					}
				}
				if (e.data.phase === 'upload') {
					uploadSpeed.target = currentSpeed;
					uploadHistory.push({ progress: e.data.progress, speed: currentSpeed });
					if (currentSpeed > maxSpeed * 0.9) {
						maxSpeed = Math.max(maxSpeed * 2, Math.ceil(currentSpeed / 100) * 100 * 1.5);
					}
				}
			} else if (type === 'result') {
				if (e.data.key === 'latency') latency.target = e.data.value;
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

		worker.postMessage({ type: 'start', duration: testDuration, urls: Api.SPEEDTEST });
	}

	onDestroy(() => {
		if (worker) worker.terminate();
	});

	// Chart Config
	const chartConfig = {
		latency: { label: 'Latency', color: 'var(--color-emerald-400)' },
		download: { label: 'Download', color: 'var(--color-cyan-400)' },
		upload: { label: 'Upload', color: 'var(--color-purple-500)' }
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
						class={[
							'flex items-center gap-2 transition-opacity duration-200',
							status === 'idle' || status === 'error' ? 'opacity-0' : 'opacity-100'
						]}
					>
						{#if status === 'finished'}
							<span class="text-sm font-medium tracking-wider text-green-500 uppercase">
								Test Complete
							</span>
						{:else}
							<span
								class="animate-pulse text-sm font-medium tracking-wider text-muted-foreground uppercase"
							>
								{status}...
							</span>
						{/if}
					</div>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-8 py-4">
			<!-- Gauges Container -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
				<!-- Latency Text -->
				<div
					class="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 p-6 transition-colors"
				>
					<div class="flex items-center gap-2 font-semibold text-foreground">
						<Activity class="h-4 w-4 text-emerald-400" />
						Latency
					</div>
					<div class="flex h-36 w-full items-center justify-center md:h-48 xl:h-56">
						<div class="flex items-baseline gap-1">
							<span class="text-6xl font-bold text-foreground tabular-nums"
								>{latency.current.toFixed(0)}</span
							>
							<span class="text-xl font-medium text-muted-foreground">ms</span>
						</div>
					</div>
				</div>

				<!-- Download Gauge -->
				<div
					class="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 p-6 transition-colors"
				>
					<div class="flex items-center gap-2 font-semibold text-foreground">
						<ArrowDown class="h-4 w-4 text-cyan-400" />
						Download Speed
					</div>
					<div class="relative w-48 xl:w-56">
						<SpeedGauge
							value={downloadSpeed.current}
							activeColor={chartConfig.download.color}
							unit="Mbps"
						/>
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
					<div class="relative w-48 xl:w-56">
						<SpeedGauge
							value={uploadSpeed.current}
							activeColor={chartConfig.upload.color}
							unit="Mbps"
						/>
					</div>
				</div>
			</div>

			<!-- Dynamic Graph -->
			<div class="w-full pt-4">
				<SpeedGraph
					{downloadHistory}
					{uploadHistory}
					{maxSpeed}
					{testDuration}
					downloadColor={chartConfig.download.color}
					uploadColor={chartConfig.upload.color}
					activePhase={status.includes('download')
						? 'download'
						: status.includes('upload')
							? 'upload'
							: null}
					currentSpeed={status.includes('download')
						? downloadSpeed.current
						: status.includes('upload')
							? uploadSpeed.current
							: 0}
					currentProgress={progress.current / 100}
				/>
			</div>

			<!-- Status Area -->
			<div class="relative h-2 w-full">
				<!-- Error Message -->
				<div
					class={[
						'absolute inset-0 flex items-center justify-center rounded-md border border-destructive/50 bg-destructive/10 text-center text-sm text-destructive transition-all duration-300',
						status === 'error'
							? 'translate-y-0 opacity-100'
							: 'pointer-events-none translate-y-2 opacity-0'
					]}
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
		<CardFooter class="flex justify-center pt-4 pb-8">
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
