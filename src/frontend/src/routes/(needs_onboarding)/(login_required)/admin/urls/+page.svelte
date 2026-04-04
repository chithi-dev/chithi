<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { useFilesQuery, type FileInfo, type FilesWithStats } from '#queries/files';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import UrlMetricsCard from './url_metrics_card.svelte';
	import OutstandingUrlsCard from './outstanding_urls_card.svelte';

	const { files, revokeFile } = useFilesQuery();

	let filesData = $derived(files.data?.files ?? []);
	let totalUrls = $derived(files.data?.total_urls ?? 0);
	let totalBytes = $derived(files.data?.total_size ?? 0);

	function isExpired(file: FileInfo) {
		const expiredByDate = file.expires_at
			? new Date(file.expires_at).getTime() <= Date.now()
			: false;
		const expiredByDownloads =
			file.expire_after_n_download !== undefined &&
			file.download_count !== undefined &&
			file.download_count >= file.expire_after_n_download;
		return expiredByDate || expiredByDownloads;
	}

	let activeUrls = $derived(filesData.filter((file) => !isExpired(file)).length);
	let linksWithDownloadCaps = $derived(files.data?.links_with_download_caps ?? 0);

	let expiringSoon = $derived(
		filesData.filter((file) => {
			if (!file.expires_at || isExpired(file)) return false;
			const msRemaining = new Date(file.expires_at).getTime() - Date.now();
			return msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000;
		}).length
	);

	let latestExpiryMs = $derived(
		files.data?.max_expires_at ? new Date(files.data.max_expires_at).getTime() : 0
	);

	let hasIndefiniteActiveUrls = $derived(
		filesData.some(
			(file) => !isExpired(file) && !file.expires_at && file.expire_after_n_download === undefined
		)
	);

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
