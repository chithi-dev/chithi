<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { useFilesQuery } from '$lib/queries/files';
	import { Trash2, FileIcon, FolderIcon, Download, Clock, CalendarClock } from 'lucide-svelte';
	import { formatFileSize } from '$lib/functions/bytes';
	import { toast } from 'svelte-sonner';
	import { fade } from 'svelte/transition';

	const { files, revokeFile } = useFilesQuery();

	let isRevoking = $state(false);

	async function handleRevoke(id: string) {
		if (!confirm('Are you sure you want to revoke this URL? This cannot be undone.')) return;

		try {
			isRevoking = true;
			await revokeFile(id);
			toast.success('URL revoked successfully');
		} catch (e) {
			toast.error('Failed to revoke URL');
		} finally {
			isRevoking = false;
		}
	}

	function formatDate(dateStr?: string) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleString();
	}
</script>

<div class="space-y-6">
	<Card.Root class="border shadow-sm">
		<Card.Header class="border-b bg-muted/20 px-6 py-4">
			<Card.Title class="text-base font-medium">Outstanding URLs</Card.Title>
			<Card.Description>Manage currently active shared files and URLs.</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			{#if files.isLoading}
				<div class="space-y-4 p-6">
					<Skeleton class="h-12 w-full" />
					<Skeleton class="h-12 w-full" />
					<Skeleton class="h-12 w-full" />
				</div>
			{:else if files.error}
				<div class="p-6 text-center text-destructive">
					Error loading files: {files.error.message}
				</div>
			{:else if !files.data || files.data.length === 0}
				<div class="p-12 text-center text-muted-foreground">No outstanding URLs found.</div>
			{:else}
				<ScrollArea class="h-[600px]">
					<div class="divide-y divide-border">
						{#each files.data as file (file.id)}
							<div
								class="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
								transition:fade
							>
								<div class="flex items-center gap-4 overflow-hidden">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
									>
										{#if file.folder_name}
											<FolderIcon class="h-5 w-5 text-primary" />
										{:else}
											<FileIcon class="h-5 w-5 text-primary" />
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate font-medium" title={file.filename}>
											{file.filename}
											{#if file.folder_name}
												<span class="ml-2 text-xs text-muted-foreground">in {file.folder_name}</span
												>
											{/if}
										</div>
										<div
											class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
										>
											{#if file.size}
												<span>{formatFileSize(file.size)}</span>
											{/if}
											<span class="flex items-center gap-1" title="Created At">
												<Clock class="h-3 w-3" />
												{formatDate(file.created_at)}
											</span>
											{#if file.expires_at}
												<span class="flex items-center gap-1" title="Expires At">
													<CalendarClock class="h-3 w-3" />
													{formatDate(file.expires_at)}
												</span>
											{/if}
											{#if file.download_count !== undefined}
												<span class="flex items-center gap-1" title="Downloads">
													<Download class="h-3 w-3" />
													{file.download_count}
													{#if file.download_limit}
														/ {file.download_limit}
													{/if}
												</span>
											{/if}
										</div>
									</div>
								</div>
								<div class="ml-4">
									<Button
										variant="ghost"
										size="icon"
										class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										onclick={() => handleRevoke(file.id)}
										disabled={isRevoking}
										title="Revoke URL"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
