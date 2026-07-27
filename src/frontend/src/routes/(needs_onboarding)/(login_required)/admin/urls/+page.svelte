<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { H2, Mutated, InlineCode } from '$lib/components/ui/typography/index.js';
	import { useFilesQuery } from '#queries/files';
	import { formatDate } from '$lib/functions/dates';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';

	const { default: OutstandingUrlsCard } = await import('./outstanding_urls_card.svelte');

	let currentPage = $state(1);
	const pageSize = 20;

	const { files, revokeFile } = useFilesQuery(() => currentPage, pageSize);

	let totalItems = $derived(files.data?.totalItems ?? 0);

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
</script>

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<H2>URLs</H2>
		<Mutated>
			Manage your <InlineCode>{page.url.origin}</InlineCode> chithi instance's uploads.
		</Mutated>
	</div>
</div>

<div class="space-y-6">
	<OutstandingUrlsCard {files} {isRevoking} {openRevokeDialog} {formatDate} />

	<div class="flex items-center justify-end py-4">
		<Pagination.Root count={totalItems} perPage={pageSize} bind:page={currentPage}>
			{#snippet children({ pages, currentPage })}
				<Pagination.Content>
					<Pagination.Item>
						<Pagination.PrevButton />
					</Pagination.Item>
					{#each pages as page (page.key)}
						{#if page.type === 'page'}
							<Pagination.Item>
								<Pagination.Link {page} isActive={currentPage === page.value}>
									{page.value}
								</Pagination.Link>
							</Pagination.Item>
						{:else}
							<Pagination.Item>
								<Pagination.Ellipsis />
							</Pagination.Item>
						{/if}
					{/each}
					<Pagination.Item>
						<Pagination.NextButton />
					</Pagination.Item>
				</Pagination.Content>
			{/snippet}
		</Pagination.Root>
	</div>

	<AlertDialog.Root open={isRevokeDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Revoke URL</AlertDialog.Title>
				<AlertDialog.Description>
					Are you sure you want to revoke this URL? This cannot be undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
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
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
