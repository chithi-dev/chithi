<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Trash2, History, Copy, Check, Download } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import {
		deleteHistoryEntry,
		cleanupExpiredEntries,
		recentUploads,
		updateHistoryEntry
	} from '$lib/database';
	import { formatFileSize } from '$lib/functions/bytes';
	import { get } from 'svelte/store';
	import { FILE_INFO_URL } from '$lib/consts/backend';

	let open = $state(false);
	let copiedId = $state<string | null>(null);

	type FileInformationOut = {
		filename: string;
		size: number;
		download_count: number;
		created_at: string;
		expires_at: string;
		expired: boolean;
	};
	const fetchFileInformation = async (key: string): Promise<FileInformationOut> => {
		const res = await fetch(`${FILE_INFO_URL}/${key}`);
		if (!res.ok) {
			throw new Error('Failed to fetch file information');
		}
		return res.json();
	};

	onMount(() => {
		const init = async () => {
			await cleanupExpiredEntries();
			const entries = get(recentUploads);

			await Promise.all(
				entries.map(async (entry) => {
					try {
						const info = await fetchFileInformation(entry.id);
						if (info.expired) {
							await deleteHistoryEntry(entry.id);
							return;
						}
						await updateHistoryEntry(entry.id, {
							name: info.filename,
							size: formatFileSize(info.size),
							expiry: new Date(info.expires_at).getTime(),
							createdAt: new Date(info.created_at).getTime(),
							downloadCount: info.download_count
						});
					} catch (error) {
						console.error(`Failed to update info for ${entry.id}`, error);
						await deleteHistoryEntry(entry.id);
					}
				})
			);
		};
		init();

		const interval = setInterval(cleanupExpiredEntries, 60000);
		return () => clearInterval(interval);
	});

	const handleDelete = async (id: string) => {
		await deleteHistoryEntry(id);
	};

	const handleCopy = (id: string, link: string) => {
		navigator.clipboard.writeText(link);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	};

	$effect(() => {
		if (open) {
			cleanupExpiredEntries();
		}
	});
</script>

{#if $recentUploads.length > 0}
	<Dialog.Root bind:open>
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Button variant="outline" size="icon" {...props} class="relative">
					<History class="h-4 w-4" />
					<span class="absolute -top-1 -right-1 flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
					</span>
				</Button>
			{/snippet}
		</Dialog.Trigger>
		<Dialog.Content class="sm:max-w-106.25">
			<Dialog.Header>
				<Dialog.Title>Recent Uploads</Dialog.Title>
				<Dialog.Description>Manage your locally stored upload history.</Dialog.Description>
			</Dialog.Header>
			<ScrollArea class="h-75 w-full rounded-md border p-4">
				<div class="space-y-4">
					{#each $recentUploads as entry (entry.id)}
						<div
							class="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-sm transition-colors hover:bg-accent/5"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="grid gap-0.5 overflow-hidden">
									<div class="truncate font-medium" title={entry.name}>{entry.name}</div>
									<div class="flex items-center gap-2 text-xs text-muted-foreground">
										<span>{entry.size}</span>
										<span>•</span>
										<span
											>{Math.max(0, parseInt(entry.downloadLimit) - (entry.downloadCount || 0))} left</span
										>
									</div>
									<div class="text-xs text-muted-foreground">
										Exp: {new Date(entry.expiry).toLocaleString()}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
									onclick={() => handleDelete(entry.id)}
								>
									<Trash2 class="h-3 w-3" />
								</Button>
							</div>
							<div class="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									class="h-7 flex-1 gap-2 text-xs"
									onclick={() => handleCopy(entry.id, entry.link)}
								>
									{#if copiedId === entry.id}
										<Check class="h-3 w-3" /> Copied
									{:else}
										<Copy class="h-3 w-3" /> Copy Link
									{/if}
								</Button>
								<Button
									variant="outline"
									size="sm"
									class="h-7 flex-1 gap-2 text-xs"
									href={entry.link}
								>
									<Download class="h-3 w-3" /> Download
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</ScrollArea>
		</Dialog.Content>
	</Dialog.Root>
{/if}
