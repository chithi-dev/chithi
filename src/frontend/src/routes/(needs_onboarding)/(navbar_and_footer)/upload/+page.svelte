<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { useConfigQuery } from '#queries/config';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import RecentUpload from './recent_upload.svelte';
	import UploadShowcase from './upload_showcase.svelte';
	import { toast } from 'svelte-sonner';
	import { dev } from '$app/environment';
	import { markdown_to_html } from '$lib/markdown/markdown';
	import { Button } from '$lib/components/ui/button';
	import { fly, fade } from 'svelte/transition';

	import Stage1 from './stage_1.svelte';
	import Stage2 from './stage_2.svelte';
	import Stage3 from './stage_3.svelte';

	const { config: configData } = useConfigQuery();

	type Stage = 1 | 2 | 3;
	let stage = $state<Stage>(1);

	let dragActive = $state(false);
	let dragOverCard = $state(false);
	let dragOverZone = $state(false);
	let dragCounter = $state(0);
	let files = $state<File[]>([]);
	let debugLoading = $state(false);
	let uploadResult = $state<{
		finalLink: string;
		viewOnceLink: string;
		isViewOnce: boolean;
	} | null>(null);

	const detailsMarkdown = $derived(configData.data?.site_description ?? '');
	let detailsHtml = $state('');

	$effect(() => {
		if (detailsMarkdown) {
			markdown_to_html(detailsMarkdown).then((html) => {
				detailsHtml = html;
			});
		}
	});

	// Handle physical mouse back button (X1) to return from stage 2 to stage 1
	const handleMouseBack = (e: MouseEvent) => {
		// button 3 is the "Back" button on most mice
		if (e.button === 3 && stage === 2) {
			stage = 1;
			e.preventDefault();
		}
	};

	const handleWindowDragEnter = (e: DragEvent) => {
		if (stage === 3) return;
		e.preventDefault();
		dragCounter++;
		e.dataTransfer && (e.dataTransfer.dropEffect = 'copy');
		dragActive = true;
	};

	const handleWindowDragLeave = (e: DragEvent) => {
		if (stage === 3) return;
		dragCounter--;
		if (dragCounter <= 0) {
			dragActive = false;
			dragCounter = 0;
		}
	};

	const handleWindowDragOver = (e: DragEvent) => {
		if (stage === 3) return;
		e.preventDefault();
		dragActive ||= true;
	};

	const handleWindowDrop = (e: DragEvent) => {
		if (stage === 3) return;
		e.preventDefault();
		dragCounter = 0;
		dragActive = false;
		dragOverZone = false;
		dragOverCard = false;
		if (e.dataTransfer?.types.includes('Files')) {
			toast.error('File/folder must be dropped into the bordered area in the dashed circle');
		}
	};

	const handleCardDragEnter = (e: DragEvent) => {
		if (stage === 3) return;
		e.preventDefault();
		dragOverCard = true;
	};

	const handleCardDragLeave = (e: DragEvent) => {
		if (stage === 3) return;
		const currentTarget = e.currentTarget as Node;
		const relatedTarget = e.relatedTarget as Node;
		if (currentTarget?.contains(relatedTarget)) return;
		dragOverCard = false;
	};

	const handleZoneDragEnter = (e: DragEvent) => {
		e.preventDefault();
		dragOverZone = true;
	};

	const handleZoneDragLeave = (e: DragEvent) => {
		const currentTarget = e.currentTarget as Node;
		const relatedTarget = e.relatedTarget as Node;
		if (currentTarget?.contains(relatedTarget)) return;
		dragOverZone = false;
	};

	const traverseFileTree = async (item: any, path = ''): Promise<File[]> => {
		try {
			if (item.isFile) {
				return new Promise((resolve) => {
					item.file(
						(file: File) => {
							if (path) {
								(file as any).relativePath = path + file.name;
							}
							resolve([file]);
						},
						(err: Error) => {
							console.error('Error reading file:', err);
							resolve([]);
						}
					);
				});
			} else if (item.isDirectory) {
				const dirReader = item.createReader();
				const entries: any[] = [];

				const readEntries = async () => {
					try {
						const result = await new Promise<any[]>((resolve, reject) => {
							dirReader.readEntries(resolve, reject);
						});

						if (result.length > 0) {
							entries.push(...result);
							await readEntries();
						}
					} catch (err) {
						console.error('Error reading directory:', err);
					}
				};

				await readEntries();

				const fileArrays = await Promise.all(
					entries.map((entry) => traverseFileTree(entry, path + item.name + '/'))
				);
				return fileArrays.flat();
			}
		} catch (err) {
			console.error('Error traversing item:', err);
		}
		return [];
	};

	const handlePaste = async (e: ClipboardEvent) => {
		if (stage === 3) return;

		const items = e.clipboardData?.items;
		if (!items) return;

		let hasFiles = false;
		for (let i = 0; i < items.length; i++) {
			if (items[i].kind === 'file') {
				hasFiles = true;
				break;
			}
		}
		if (!hasFiles) return;

		e.preventDefault();

		const promises: Array<Promise<Array<File>>> = new Array();
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.kind !== 'file') continue;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
			if (entry) {
				promises.push(traverseFileTree(entry));
			} else {
				const file = item.getAsFile();
				if (file) promises.push(Promise.resolve([file]));
			}
		}

		const fileArrays = await Promise.all(promises);
		const newFiles = fileArrays.flat();
		if (newFiles.length > 0) {
			onFilesSelected(newFiles);
		}
	};

	const onFilesSelected = (newFiles: File[]) => {
		files = [...files, ...newFiles];
		stage = 2;
		window.history.pushState({ stage: 2 }, '');
	};

	const onUploadComplete = (result: {
		finalLink: string;
		viewOnceLink: string;
		isViewOnce: boolean;
	}) => {
		uploadResult = result;
		stage = 3;
		window.history.pushState({ stage: 3 }, '');
	};

	const onReset = () => {
		files = [];
		uploadResult = null;
		stage = 1;
		window.history.pushState({ stage: 1 }, '');
	};

	const handlePopState = (e: PopStateEvent) => {
		if (e.state && typeof e.state.stage === 'number') {
			stage = e.state.stage;
		} else {
			stage = 1;
		}
	};
</script>

<svelte:window
	ondragenter={handleWindowDragEnter}
	ondragover={handleWindowDragOver}
	ondragleave={handleWindowDragLeave}
	ondrop={handleWindowDrop}
	onpaste={handlePaste}
	onauxclick={handleMouseBack}
	onpointerdown={handleMouseBack}
	onpopstate={handlePopState}
/>

{#snippet encryptionInfo()}
	<div class="flex h-full w-full flex-col justify-center p-4 lg:p-8">
		<h2 class="mb-4 text-2xl font-bold md:mb-2 md:text-xl lg:mb-6 lg:text-3xl">
			End-to-End Encryption
		</h2>
		<p class="mb-6 text-muted-foreground md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed">
			Your files are encrypted in your browser before they are ever uploaded. This means only you
			and the people you share the link with can access them. We cannot see your files.
		</p>
		<div class="rounded-xl border border-border bg-muted/50 p-4 md:p-3 lg:p-5">
			<h3 class="mb-2 font-semibold">How it works</h3>
			<p class="text-sm text-muted-foreground">
				A unique key is generated for each upload. This key is used to encrypt your files and is
				included in the share link after the '#' symbol. The server never receives this key.
			</p>
		</div>
	</div>
{/snippet}

{#snippet configSkeleton()}
	<div
		class="relative flex h-full w-full flex-col items-center justify-center rounded-lg bg-card p-12"
	>
		<svg class="pointer-events-none absolute inset-0 h-full w-full rounded-lg">
			<rect
				width="100%"
				height="100%"
				rx="8"
				ry="8"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="text-border"
				stroke-dasharray="10"
			/>
		</svg>
		<Skeleton class="mb-6 h-16 w-16 rounded-full" />
		<Skeleton class="mb-2 h-7 w-48" />
		<Skeleton class="mx-auto mb-8 h-6 w-full md:mb-4 md:h-5" />
		<Skeleton class="h-19 w-64 rounded-md md:h-14 md:w-56" />
	</div>
{/snippet}

{#snippet rightColumnSkeleton()}
	<div class="flex h-full w-full flex-col p-4 lg:p-8">
		<ScrollArea class="h-auto w-full lg:h-full">
			<div
				class="prose w-full max-w-none prose-zinc md:text-sm lg:text-lg lg:leading-relaxed dark:prose-invert"
			>
				<Skeleton class="mb-4 h-8 w-1/2" />
				<div class="space-y-2">
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-2/4" />
					<br />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-2/3" />

					<br />
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-1/3" />
				</div>
			</div>
		</ScrollArea>
	</div>
{/snippet}

<Card
	class={[
		'relative z-10 mx-auto w-full max-w-5xl border-border bg-card transition-all duration-200',
		dragActive && 'shadow-[0_0_20px_-10px_var(--primary)]',
		dragOverCard && 'shadow-[0_0_40px_-10px_var(--primary)]',
		dragOverZone && 'shadow-[0_0_60px_-10px_var(--primary)]'
	]}
	ondrop={(e) => {
		if (stage === 3) return;
		e.preventDefault();
		e.stopPropagation();
		dragCounter = 0;
		dragActive = false;
		dragOverZone = false;
		dragOverCard = false;
		toast.error('File/Folder must be dropped in the bordered area');
	}}
	ondragenter={handleCardDragEnter}
	ondragleave={handleCardDragLeave}
>
	<div class="absolute top-4 right-4 z-20">
		<RecentUpload />
	</div>
	<CardContent class="p-6">
		<div class="grid min-h-150 grid-cols-1 gap-8 lg:grid-cols-2">
			{#if configData.isLoading || (dev && debugLoading)}
				<div class="col-span-1">
					{@render configSkeleton()}
				</div>
				<div class="col-span-1">
					{@render rightColumnSkeleton()}
				</div>
			{:else if stage === 1}
				<div in:fly={{ x: -20, duration: 400 }}>
					<Stage1
						{onFilesSelected}
						isDraggingOverZone={dragOverZone}
						onZoneDragEnter={handleZoneDragEnter}
						onZoneDragLeave={handleZoneDragLeave}
					/>
				</div>
				<div class="flex h-full w-full flex-col p-4 lg:p-8" in:fade>
					<ScrollArea class="h-auto w-full lg:h-full">
						<div
							class="prose w-full max-w-none prose-zinc md:text-sm lg:text-lg lg:leading-relaxed dark:prose-invert"
						>
							{@html detailsHtml}
						</div>
					</ScrollArea>
				</div>
			{:else if stage === 2}
				<div in:fly={{ x: 20, duration: 400 }}>
					<Stage2
						bind:files
						onFilesUpdated={(newFiles) => (files = newFiles)}
						{onUploadComplete}
						onBack={() => (stage = 1)}
						isDraggingOverZone={dragOverZone}
						onZoneDragEnter={handleZoneDragEnter}
						onZoneDragLeave={handleZoneDragLeave}
					/>
				</div>
				<div in:fade>
					{@render encryptionInfo()}
				</div>
			{:else if stage === 3 && uploadResult}
				<div class="col-span-1 lg:col-span-2" in:fly={{ y: 20, duration: 400 }}>
					<Stage3
						finalLink={uploadResult.finalLink}
						viewOnceLink={uploadResult.viewOnceLink}
						isViewOnce={uploadResult.isViewOnce}
						{onReset}
					/>
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

<UploadShowcase localUploadSize={stage === 2 ? files.reduce((s, f) => s + f.size, 0) : 0} />

{#if dev}
	<div class="fixed bottom-4 left-4 z-50">
		<Button onclick={() => (debugLoading = !debugLoading)}>Toggle Skeleton</Button>
	</div>
{/if}
