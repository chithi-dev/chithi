<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { useFilesQuery } from '#queries/files';
	import { Trash2, FileIcon, FolderIcon, Download, Clock, CalendarClock } from 'lucide-svelte';
	import { formatFileSize } from '#functions/bytes';
	import { toast } from 'svelte-sonner';
	import { Separator } from '$lib/components/ui/separator';
	import { page } from '$app/state';

	const { files, revokeFile } = useFilesQuery();

	const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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

<div class="flex items-center justify-between border-b border-border px-6 py-4">
	<div>
		<h1 class="text-lg font-semibold">Public Urls Information</h1>
		<p class="text-sm text-muted-foreground">
			Manage your <code>{page.url.origin}</code> chithi instance's uploads.
		</p>
	</div>
</div>

<Separator class="mb-10" />

<div class="space-y-6">
	<Card.Root class="bg-background border">
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[40%]">File Name</Table.Head>
						<Table.Head>Size</Table.Head>
						<Table.Head>Activity</Table.Head>
						<Table.Head>Downloads</Table.Head>
						<Table.Head class="text-right">Action</Table.Head>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{#if files.isLoading}
						{#each Array(3) as _}
							<Table.Row>
								<Table.Cell><Skeleton class="h-6 w-50" /></Table.Cell>
								<Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
								<Table.Cell><Skeleton class="h-6 w-30" /></Table.Cell>
								<Table.Cell><Skeleton class="h-6 w-12.5" /></Table.Cell>
								<Table.Cell><Skeleton class="ml-auto h-8 w-8" /></Table.Cell>
							</Table.Row>
						{/each}
					{:else if files.error}
						<Table.Row>
							<Table.Cell colspan={5} class="h-24 text-center text-destructive">
								Error loading files: {files.error.message}
							</Table.Cell>
						</Table.Row>
					{:else if !files.data || files.data.length === 0}
						<Table.Row>
							<Table.Cell colspan={5} class="h-32 text-center text-muted-foreground">
								No outstanding URLs found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each files.data as file (file.id)}
							<Table.Row class="group">
								<Table.Cell class="font-medium">
									<div class="flex items-center gap-3">
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
										>
											{#if file.folder_name}
												<FolderIcon class="h-4 w-4 text-primary" />
											{:else}
												<FileIcon class="h-4 w-4 text-primary" />
											{/if}
										</div>
										<div class="flex flex-col">
											<span class="max-w-50 truncate lg:max-w-75" title={file.filename}>
												{file.filename}
											</span>
											{#if file.folder_name}
												<span class="text-xs text-muted-foreground">
													in {file.folder_name}
												</span>
											{/if}
										</div>
									</div>
								</Table.Cell>

								<Table.Cell class="whitespace-nowrap text-muted-foreground">
									{file.size ? formatFileSize(file.size) : '-'}
								</Table.Cell>

								<Table.Cell>
									<div class="flex flex-col gap-1 text-xs text-muted-foreground">
										<span class="flex items-center gap-1.5" title="Created At">
											<Clock class="h-3 w-3" />
											{formatDate(file.created_at)}
										</span>
										{#if file.expires_at}
											<span class="flex items-center gap-1.5 text-orange-600/80" title="Expires At">
												<CalendarClock class="h-3 w-3" />
												{formatDate(file.expires_at)}
											</span>
										{/if}
									</div>
								</Table.Cell>

								<Table.Cell>
									{#if file.download_count !== undefined}
										<div class="flex items-center gap-1.5 text-sm text-muted-foreground">
											<Download class="h-3.5 w-3.5" />
											<span>{file.download_count}</span>
											{#if file.expire_after_n_download}
												<span class="opacity-50">/ {file.expire_after_n_download}</span>
											{/if}
										</div>
									{/if}
								</Table.Cell>

								<Table.Cell class="text-right">
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
										onclick={() => openRevokeDialog(file.id)}
										disabled={isRevoking}
										title="Revoke URL"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

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
