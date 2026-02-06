<script lang="ts">
	import { onDestroy } from 'svelte';
	import { BACKEND_API } from '$lib/consts/backend';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
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

	// Gauge config
	const radius = 90;
	const stroke = 12;
	const normalizedRadius = radius - stroke * 2;
	const circumference = normalizedRadius * 2 * Math.PI;
    // 240 degree arc (leaving bottom 120 open)
    // Actually standard speedtest is usually 240-270 deg.
    // Let's do a semi-circle + bit more (220 deg).
    // Start angle: 160 deg, End angle: 20 deg (mathematical 0 is right)
    // Simpler: CSS rotation.
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
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				
				<!-- Download Gauge -->
				<div class="flex flex-col items-center gap-4">
					{@render Gauge('Download', downloadSpeed, status === 'downloading' || status === 'finished' ? downloadSpeed : 0, maxSpeed, 'text-cyan-500')}
				</div>

				<!-- Upload Gauge -->
				<div class="flex flex-col items-center gap-4">
					{@render Gauge('Upload', uploadSpeed, status === 'uploading' || status === 'finished' ? uploadSpeed : 0, maxSpeed, 'text-purple-500')}
				</div>
			</div>

            <!-- Status & Progress -->
             <div class="text-center h-8">
                {#if status !== 'idle' && status !== 'finished' && status !== 'error'}
                    <span class="text-muted-foreground animate-pulse text-sm font-medium uppercase tracking-wider">
                        {status}...
                    </span>
                    <!-- You could add a small progress bar here too if you wanted -->
                {:else if status === 'finished'}
                    <span class="text-green-500 text-sm font-medium uppercase tracking-wider">Test Complete</span>
                {:else if status === 'error'}
                    <span class="text-red-500 text-sm font-medium uppercase tracking-wider">Error: {errorMsg}</span>
                {/if}
             </div>

		</Card.Content>
		<Card.Footer class="flex justify-center pb-8">
			{#if status === 'idle' || status === 'finished' || status === 'error'}
				<Button size="lg" onclick={startTest} class="w-48 gap-2 text-lg font-semibold shadow-lg transition-all hover:scale-105 active:scale-95">
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

{#snippet Gauge(title: string, value: number, displayValue: number, max: number, colorClass: string)}
	<div class="relative flex flex-col items-center">
        <!-- SVG Gauge -->
		<div class="relative h-48 w-48">
             <svg class="h-full w-full rotate-[135deg] transform" viewBox="0 0 200 200">
                <!-- Background Circle Track -->
                 <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="12"
                    class="text-muted/20"
                    stroke-dasharray={534} 
                    stroke-dashoffset={534 * (1 - 0.75)} 
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 0.5s ease;"
                 />
                 <!-- Value Arc -->
                  <!-- 534 is approx circumference of r=85 (2*PI*85 = 534) -->
                  <!-- We only want 75% of circle (270 deg) -->
                  <!-- value/max * 0.75 -->
                 <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="12"
                    class={colorClass}
                    stroke-dasharray={534} 
                    stroke-dashoffset={534 * (1 - (0.75 * Math.min(value / max, 1)))} 
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 0.1s linear;"
                 />
             </svg>
             <!-- Center Text -->
             <div class="absolute inset-0 flex flex-col items-center justify-center pt-4">
                 <span class={["text-4xl font-bold font-mono tracking-tighter", colorClass]}>
                    {displayValue.toFixed(1)}
                 </span>
                 <span class="text-sm text-muted-foreground font-medium">Mbps</span>
             </div>
        </div>
        
        <!-- Legend -->
        <div class="mt-2 flex items-center gap-2">
            {#if title === 'Download'}
                <Download class="h-4 w-4 text-muted-foreground" />
            {:else}
                <UploadIcon class="h-4 w-4 text-muted-foreground" />
            {/if}
            <span class="text-lg font-medium text-foreground">{title}</span>
        </div>
	</div>
{/snippet}

<style>
    /* Custom transforms for the gauge if needed, but Tailwind classes handle most */
</style>
