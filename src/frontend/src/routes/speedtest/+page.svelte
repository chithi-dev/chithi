<script lang="ts">
	import { onDestroy } from 'svelte';
	import { BACKEND_API } from '$lib/consts/backend';
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { Button } from '$lib/components/ui/button';
	import { PieChart, Text } from 'layerchart';
	import { Play, RotateCw, Download, Upload as UploadIcon, Activity } from 'lucide-svelte';
	import SpeedtestWorker from '$lib/workers/speedtest.worker?worker'; // Import worker

	let worker: Worker | undefined;
	let status = $state('idle'); // idle, downloading, uploading, finished, error
	let downloadSpeed = $state(0);
	let uploadSpeed = $state(0);
	let progress = $state(0);
	let errorMsg = $state('');

	let maxSpeed = $state(100); // Dynamic scale for the gauge

	function startTest() {
		if (worker) worker.terminate();
		worker = new SpeedtestWorker();

		status = 'starting';
		downloadSpeed = 0;
		uploadSpeed = 0;
		progress = 0;
		errorMsg = '';
		maxSpeed = 100;

		worker.onmessage = (e) => {
			const { type } = e.data;
			if (type === 'phase') {
				if (e.data.phase === 'download') status = 'downloading';
				if (e.data.phase === 'upload') status = 'uploading';
				progress = 0;
			} else if (type === 'progress') {
				progress = e.data.progress * 100;
				const currentSpeed = e.data.speed;
				
				if (e.data.phase === 'download') downloadSpeed = currentSpeed;
				if (e.data.phase === 'upload') uploadSpeed = currentSpeed;

				// Adjust gauge scale if speed exceeds current max
				if (currentSpeed > maxSpeed * 0.9) {
					maxSpeed = Math.max(maxSpeed * 2, Math.ceil(currentSpeed / 100) * 100 * 1.5);
				}
			} else if (type === 'result') {
				if (e.data.key === 'download') downloadSpeed = e.data.value;
				if (e.data.key === 'upload') uploadSpeed = e.data.value;
			} else if (type === 'finish') {
				status = 'finished';
				progress = 100;
			} else if (type === 'error') {
				status = 'error';
				errorMsg = e.data.error;
			}
		};

		worker.postMessage({ type: 'start', baseUrl: BACKEND_API });
	}

	onDestroy(() => {
		if (worker) worker.terminate();
	});

	// Chart Config
	const chartConfig = {
		download: { label: 'Download', color: 'hsl(188 86% 53%)' },
		upload: { label: 'Upload', color: 'hsl(271 81% 56%)' },
		remaining: { label: 'Remaining', color: 'hsl(var(--muted))' }
	} satisfies Chart.ChartConfig;
</script>

<div class="container mx-auto flex h-full max-w-4xl flex-col items-center justify-center p-4">
	<Card.Root class="w-full">
		<Card.Header>
			<Card.Title class="flex items-center gap-2 text-2xl">
				<Activity class="h-6 w-6" /> Speedtest
			</Card.Title>
			<Card.Description>Check your internet connection speed to the server.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-8 py-8">
			<!-- Gauges Container -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Download Gauge -->
				<div class="flex flex-col items-center gap-4">
					<div class="font-medium text-foreground">Download Speed</div>
					<div class="relative w-48 h-48">
						{#if status === 'downloading' || status === 'finished' || downloadSpeed > 0}
							{@render RadialGauge(
								'download', 
								downloadSpeed, 
								maxSpeed, 
								chartConfig.download.color
							)}
						{:else}
							{@render RadialGauge(
								'download', 
								0, 
								maxSpeed, 
								chartConfig.download.color
							)}
						{/if}
					</div>
				</div>

				<!-- Upload Gauge -->
				<div class="flex flex-col items-center gap-4">
					<div class="font-medium text-foreground">Upload Speed</div>
					<div class="relative w-48 h-48">
						{#if status === 'uploading' || status === 'finished' || uploadSpeed > 0}
							{@render RadialGauge(
								'upload', 
								uploadSpeed, 
								maxSpeed, 
								chartConfig.upload.color
							)}
						{:else}
							{@render RadialGauge(
								'upload', 
								0, 
								maxSpeed, 
								chartConfig.upload.color
							)}
						{/if}
					</div>
				</div>
			</div>

			<!-- Status & Progress -->
			<div class="h-8 text-center">
				{#if status !== 'idle' && status !== 'finished' && status !== 'error'}
					<span
						class="text-muted-foreground animate-pulse text-sm font-medium uppercase tracking-wider"
					>
						{status}...
					</span>
				{:else if status === 'finished'}
					<span class="text-green-500 text-sm font-medium uppercase tracking-wider">Test Complete</span
					>
				{:else if status === 'error'}
					<span class="text-red-500 text-sm font-medium uppercase tracking-wider"
						>Error: {errorMsg}</span
					>
				{/if}
			</div>
		</Card.Content>
		<Card.Footer class="flex justify-center pb-8">
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
		</Card.Footer>
	</Card.Root>
</div>

{#snippet RadialGauge(id: string, value: number, max: number, activeColor: string)}
	<Chart.Container
		config={chartConfig}
		class="mx-auto aspect-square max-h-[250px] w-full"
	>
		<PieChart
			data={[
				{ key: 'value', value: value, color: activeColor },
				{ key: 'remaining', value: Math.max(0, max - value), color: chartConfig.remaining.color }
			]}
			key="key"
			value="value"
			c="color"
			innerRadius={76}
			padding={0}
			range={[-90, 90]}
			props={{ pie: { sort: null } }}
			cornerRadius={4}
		>
            {#snippet aboveMarks()}
               <Text
                value={String(value.toFixed(1))}
                textAnchor="middle"
                verticalAnchor="middle"
                class="fill-foreground text-3xl font-bold"
                dy={-16}
               />
               <Text
                value="Mbps"
                textAnchor="middle"
                verticalAnchor="middle"
                class="fill-muted-foreground text-sm"
                dy={12}
               />
            {/snippet}
        </PieChart>
	</Chart.Container>
{/snippet}
