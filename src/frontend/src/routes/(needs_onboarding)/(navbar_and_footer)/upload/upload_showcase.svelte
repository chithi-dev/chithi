<script lang="ts">
	import { HardDrive } from '@lucide/svelte';

	// localUploadSize is accepted for backward-compatibility with the parent
	// (upload/+page.svelte) but is no longer used to drive any live UI.
	const { localUploadSize = 0 }: { localUploadSize: number } = $props();
</script>

<!-- This component previously rendered a live storage-usage bar fed by the
     ws/state WebSocket (appState / subscribeAppState). The backend never
     registered that route, so the entire WS + live-storage UI has been
     removed. Uploads still work through the upload API; this file is
     intentionally minimal now. -->
<div class="mx-auto mt-6 w-full max-w-5xl">
	<div class="overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
		<div class="mb-1 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500">
					<HardDrive class="h-4 w-4" />
				</div>
				<span class="text-sm font-medium">Available Storage</span>
			</div>
		</div>
		<p class="text-xs text-muted-foreground">
			{#if localUploadSize > 0}
				Uploading {Math.round(localUploadSize / 1024 / 1024)} MB…
			{:else}
				Storage limits are managed on the admin config page.
			{/if}
		</p>
	</div>
</div>
