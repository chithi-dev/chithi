<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { formatFileSize } from '#functions/bytes';
	import { subscribeAppState, appState } from './state.svelte';
	import { HardDrive, Wifi, WifiOff } from 'lucide-svelte';
	import { Progress } from '$lib/components/ui/progress';
	import * as Tooltip from '$lib/components/ui/tooltip/index';
	import { cn } from '$lib/utils';

	let { localUploadSize = 0 }: { localUploadSize: number } = $props();

	// Distinct Tailwind colors for each active upload segment
	const SEGMENT_COLORS = [
		'bg-sky-500',
		'bg-violet-500',
		'bg-amber-500',
		'bg-rose-500',
		'bg-emerald-500',
		'bg-orange-500',
		'bg-teal-500',
		'bg-pink-500'
	];

	const SEGMENT_LEGEND_COLORS = [
		'bg-sky-400',
		'bg-violet-400',
		'bg-amber-400',
		'bg-rose-400',
		'bg-emerald-400',
		'bg-orange-400',
		'bg-teal-400',
		'bg-pink-400'
	];

	// Minimum visible width (%) for any segment so tiny uploads are still perceptible
	const MIN_SEGMENT_PCT = 0.6;

	const tweenOpts = { duration: 600, easing: cubicOut };

	// Split uploads into finished and active (in-progress)
	let finishedUploads = $derived(appState.current.active_uploads.filter((u) => u.done));
	let activeUploads = $derived(appState.current.active_uploads.filter((u) => !u.done));

	let finishedBytes = $derived(finishedUploads.reduce((s, u) => s + u.uploaded_bytes, 0));
	let activeBytes = $derived(activeUploads.reduce((s, u) => s + u.uploaded_bytes, 0));
	let allInflightBytes = $derived(finishedBytes + activeBytes);

	let remaining = $derived.by(() => {
		const st = appState.current;
		if (!st.total_available_space) return 0;
		return Math.max(
			0,
			st.total_available_space - st.total_space_used - allInflightBytes - localUploadSize
		);
	});

	// capacity = remaining free space + all in-flight bytes + local prediction
	let capacity = $derived(remaining + allInflightBytes + localUploadSize);

	// Total bar fill (finished + active + local) as a percentage
	let totalConsumptionPct = $derived.by(() => {
		if (capacity <= 0) return 0;
		return Math.min(100, ((allInflightBytes + localUploadSize) / capacity) * 100);
	});

	// Finished uploads: single tween for the combined segment on the left
	let finishedPct = new Tween(0, tweenOpts);

	// Local upload prediction: single tween for the "Your upload" segment
	let localPct = new Tween(0, tweenOpts);

	// Active uploads: one tween per in-progress upload
	let uploadPcts = $state<Tween<number>[]>([]);

	$effect(() => {
		if (capacity > 0) {
			finishedPct.target = (finishedBytes / capacity) * 100;
		} else {
			finishedPct.target = 0;
		}
	});

	$effect(() => {
		if (capacity > 0 && localUploadSize > 0) {
			localPct.target = (localUploadSize / capacity) * 100;
		} else {
			localPct.target = 0;
		}
	});

	$effect(() => {
		if (capacity > 0 && activeUploads.length > 0) {
			while (uploadPcts.length < activeUploads.length) {
				uploadPcts.push(new Tween(0, tweenOpts));
			}
			if (uploadPcts.length > activeUploads.length) {
				uploadPcts = uploadPcts.slice(0, activeUploads.length);
			}
			for (let i = 0; i < activeUploads.length; i++) {
				uploadPcts[i].target = (activeUploads[i].uploaded_bytes / capacity) * 100;
			}
		} else {
			uploadPcts = [];
		}
	});

	onMount(() => {
		const unsub = subscribeAppState();
		return unsub;
	});
</script>

<div class="mx-auto mt-6 w-full max-w-5xl">
	<div
		class="overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
	>
		<!-- Header row -->
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500"
				>
					<HardDrive class="h-4 w-4" />
				</div>
				<span class="text-sm font-medium">Available Storage</span>
			</div>

			<div class="flex items-center gap-3">
				{#if appState.current.active_uploads.length > 0}
					<span class="text-xs text-muted-foreground">
						{#if finishedUploads.length > 0}
							<span class="font-semibold tabular-nums">{finishedUploads.length}</span>
							finished,
						{/if}
						<span class="font-semibold tabular-nums">{activeUploads.length}</span>
						{activeUploads.length === 1 ? 'upload' : 'uploads'} in progress
					</span>
				{/if}

				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<div
								class={cn(
									'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
									appState.connected
										? 'bg-primary/10 text-primary'
										: 'bg-muted text-muted-foreground'
								)}
							>
								{#if appState.connected}
									<Wifi class="h-3 w-3" />
									<span>Live</span>
								{:else}
									<WifiOff class="h-3 w-3" />
									<span>Offline</span>
								{/if}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content>
							{appState.connected
								? 'Connected — updates in real time'
								: 'Disconnected — reconnecting'}
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>

		<!-- Progress bar with per-segment tooltips -->
		<Tooltip.Provider>
			<div class="relative w-full">
				<Progress
					value={totalConsumptionPct}
					max={100}
					class="h-5 **:data-[slot=progress-indicator]:bg-transparent"
				/>
				<!-- Segment overlay container -->
				<div class="absolute inset-0 overflow-hidden rounded-full">
					<!-- Finished uploads segment -->
					{#if finishedPct.current > 0}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="absolute inset-y-0 left-0 z-10 cursor-default"
								style="width: {Math.max(finishedPct.current, MIN_SEGMENT_PCT)}%"
							>
								<div class="h-full w-full bg-slate-500 transition-all duration-500"></div>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<div class="flex items-center gap-2 text-xs">
									<span class="inline-block h-2 w-2 rounded-full bg-slate-400"></span>
									<span class="text-muted-foreground">
										{finishedUploads.length}
										{finishedUploads.length === 1 ? 'upload' : 'uploads'} finished
									</span>
									<span class="font-semibold tabular-nums">{formatFileSize(finishedBytes)}</span>
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<!-- Active uploads segments -->
					{#each uploadPcts as pct, i}
						{@const offset =
							(finishedPct.current > 0 ? Math.max(finishedPct.current, MIN_SEGMENT_PCT) : 0) +
							uploadPcts.slice(0, i).reduce((s, t) => s + Math.max(t.current, MIN_SEGMENT_PCT), 0)}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="absolute inset-y-0 z-10 cursor-default"
								style="left: {offset}%; width: {Math.max(pct.current, MIN_SEGMENT_PCT)}%"
							>
								<div
									class={cn(
										'h-full w-full animate-pulse transition-all duration-500',
										SEGMENT_COLORS[i % SEGMENT_COLORS.length]
									)}
									style="animation-duration: 2s; animation-delay: {i * 150}ms"
								></div>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<div class="space-y-0.5 text-xs">
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'inline-block h-2 w-2 rounded-full',
												SEGMENT_LEGEND_COLORS[i % SEGMENT_LEGEND_COLORS.length]
											)}
										></span>
										<span class="max-w-32 truncate font-medium">{activeUploads[i]?.filename}</span>
									</div>
									<div class="pl-4 text-muted-foreground">
										{formatFileSize(activeUploads[i]?.uploaded_bytes ?? 0)} uploaded
									</div>
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					{/each}

					<!-- Local upload prediction segment -->
					{#if localPct.current > 0}
						{@const localOffset =
							(finishedPct.current > 0 ? Math.max(finishedPct.current, MIN_SEGMENT_PCT) : 0) +
							uploadPcts.reduce((s, t) => s + Math.max(t.current, MIN_SEGMENT_PCT), 0)}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="absolute inset-y-0 z-10 cursor-default"
								style="left: {localOffset}%; width: {Math.max(localPct.current, MIN_SEGMENT_PCT)}%"
							>
								<div
									class="h-full w-full animate-pulse bg-indigo-500/60 transition-all duration-500"
									style="animation-duration: 1.5s;
										background-image: repeating-linear-gradient(
											-45deg, transparent, transparent 3px,
											rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px
										)"
								></div>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<div class="flex items-center gap-2 text-xs">
									<span class="inline-block h-2 w-2 rounded-full bg-indigo-400"></span>
									<span class="text-muted-foreground">Your upload</span>
									<span class="font-semibold tabular-nums">{formatFileSize(localUploadSize)}</span>
								</div>
							</Tooltip.Content>
						</Tooltip.Root>
					{/if}

					<!-- Diagonal stripe overlay on active uploads -->
					{#if uploadPcts.length > 0}
						{@const activeStartPct =
							finishedPct.current > 0 ? Math.max(finishedPct.current, MIN_SEGMENT_PCT) : 0}
						{@const activeWidthPct = uploadPcts.reduce(
							(s, t) => s + Math.max(t.current, MIN_SEGMENT_PCT),
							0
						)}
						<div
							class="pointer-events-none absolute inset-y-0 opacity-15"
							style="left: {activeStartPct}%; width: {activeWidthPct}%;
								background-image: repeating-linear-gradient(
									45deg, transparent, transparent 4px,
									rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px
								)"
						></div>
					{/if}

					<!-- Remaining space tooltip  -->
					{#if appState.current.total_available_space}
						{@const filledPct =
							(finishedPct.current > 0 ? Math.max(finishedPct.current, MIN_SEGMENT_PCT) : 0) +
							uploadPcts.reduce((s, t) => s + Math.max(t.current, MIN_SEGMENT_PCT), 0) +
							(localPct.current > 0 ? Math.max(localPct.current, MIN_SEGMENT_PCT) : 0)}
						{#if filledPct < 100}
							<Tooltip.Root>
								<Tooltip.Trigger
									class="absolute inset-y-0 right-0 z-10 cursor-default"
									style="left: {filledPct}%"
								>
									<div class="h-full w-full"></div>
								</Tooltip.Trigger>
								<Tooltip.Content>
									<div class="flex items-center gap-2 text-xs">
										<span class="inline-block h-2 w-2 rounded-full bg-muted-foreground/30"></span>
										<span class="text-muted-foreground">Remaining</span>
										<span class="font-semibold tabular-nums">{formatFileSize(remaining)}</span>
									</div>
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					{/if}
				</div>
			</div>
		</Tooltip.Provider>

		<!-- Compact summary row -->
		<div class="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
			<span>
				{#if appState.current.total_available_space}
					<span class="font-semibold text-foreground tabular-nums">{formatFileSize(remaining)}</span
					>
					remaining
				{:else}
					Storage info unavailable
				{/if}
			</span>

			{#if allInflightBytes > 0 || localUploadSize > 0}
				<div class="flex items-center gap-2">
					{#if finishedUploads.length > 0}
						<span class="flex items-center gap-1">
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"></span>
							{finishedUploads.length} done
						</span>
					{/if}
					{#if localUploadSize > 0}
						<span class="flex items-center gap-1">
							<span
								class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400"
								style="animation-duration: 1.5s"
							></span>
							<span class="font-semibold text-indigo-500 tabular-nums"
								>{formatFileSize(localUploadSize)}</span
							>
						</span>
					{/if}
					{#if activeUploads.length > 0}
						<span class="flex items-center gap-1">
							<span
								class={cn(
									'inline-block h-1.5 w-1.5 animate-pulse rounded-full',
									SEGMENT_LEGEND_COLORS[0]
								)}
								style="animation-duration: 2s"
							></span>
							{activeUploads.length} uploading
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
