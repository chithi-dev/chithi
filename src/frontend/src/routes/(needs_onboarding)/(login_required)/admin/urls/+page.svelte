<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { useFilesQuery, type FileInfo } from '#queries/files';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import UrlMetricsCard from './url_metrics_card.svelte';
	import OutstandingUrlsCard from './outstanding_urls_card.svelte';

	const limit = 20;
	let cursorHistory = $state<(string | null)[]>([null]);
	let currentIndex = $state(0);

	const { files, revokeFile } = useFilesQuery(() => cursorHistory[currentIndex], limit);

	let totalUrls = $derived(files.data?.total ?? 0);
	let totalBytes = $derived(files.data?.total_bytes ?? 0);
	let activeUrls = $derived(files.data?.active_urls ?? 0);
	let linksWithDownloadCaps = $derived(files.data?.links_with_download_caps ?? 0);
	let expiringSoon = $derived(files.data?.expiring_soon ?? 0);
	let latestExpiryMs = $derived(
		files.data?.latest_expiry ? new Date(files.data.latest_expiry).getTime() : 0
	);
	let hasIndefiniteActiveUrls = $derived(files.data?.has_indefinite_active_urls ?? false);

	function formatDuration(ms: number) {
		if (ms <= 0) return 'Now';
		const totalMinutes = Math.ceil(ms / 60000);
		const days = Math.floor(totalMinutes / (60 * 24));
		const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
		const minutes = totalMinutes % 60;

		if (days > 0) return `${days}d ${hours}h`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	let timeToClearLabel = $derived.by(() => {
		if (activeUrls === 0) return 'Cleared';
		if (hasIndefiniteActiveUrls) return 'Indefinite';
		if (!latestExpiryMs) return 'Unknown';
		return formatDuration(latestExpiryMs - Date.now());
	});

	// States
	let isRevoking = $state(false);
	let isRevokeDialogOpen = $state(false);
	let fileToRevoke = $state<string | null>(null);

	function openRevokeDialog(id: string) {
		fileToRevoke = id;
		isRevokeDialogOpen = true;
	}

	async function confirmRevoke() {
		if (!fileToRevoke) return;

		try {
			isRevoking = true;
			await revokeFile(fileToRevoke);
			toast.success('URL revoked successfully');
			isRevokeDialogOpen = false;
		} catch (e) {
			toast.error('Failed to revoke URL');
		} finally {
			isRevoking = false;
		}
	}

	function formatDate(dateStr?: string) {
		if (!dateStr) return 'N/A';
		const date = new Date(dateStr).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
		return date;
	}
</script>

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<h2 class="text-3xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">
			Manage your <code>{page.url.origin}</code> chithi instance's uploads.
		</p>
	</div>
</div>

<div class="space-y-6">
	<UrlMetricsCard
		{totalUrls}
		{timeToClearLabel}
		{totalBytes}
		{linksWithDownloadCaps}
		{expiringSoon}
	/>
	<OutstandingUrlsCard {files} {isRevoking} {openRevokeDialog} {formatDate} />

	<div class="flex items-center justify-end space-x-2 py-4">
		<Button
			variant="outline"
			size="sm"
			onclick={() => (currentIndex = Math.max(0, currentIndex - 1))}
			disabled={currentIndex === 0 || files.isLoading}
		>
			Previous
		</Button>
		<div class="text-sm font-medium">
			Page {currentIndex + 1}
		</div>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				if (currentIndex === cursorHistory.length - 1 && files.data?.next_cursor) {
					cursorHistory.push(files.data.next_cursor);
				}
				currentIndex = currentIndex + 1;
			}}
			disabled={(!files.data?.next_cursor && currentIndex === cursorHistory.length - 1) || files.isLoading}
		>
			Next
		</Button>
	</div>

	<Dialog.Root bind:open={isRevokeDialogOpen}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>Revoke URL</Dialog.Title>
				<Dialog.Description>
					Are you sure you want to revoke this URL? This cannot be undone.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (isRevokeDialogOpen = false)} disabled={isRevoking}
					>Cancel</Button
				>
				<Button variant="destructive" onclick={confirmRevoke} disabled={isRevoking}>
					{#if isRevoking}
						Revoking...
					{:else}
						Revoke
					{/if}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
