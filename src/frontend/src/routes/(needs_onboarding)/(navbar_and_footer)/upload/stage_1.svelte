<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus } from '@lucide/svelte';
	import { formatFileSize } from '#functions/bytes';
	import { useConfigQuery } from '#queries/config';

	interface Props {
		onFilesSelected: (files: File[], folderName?: string) => void;
		isDraggingOverZone: boolean;
		onZoneDragEnter: (e: DragEvent) => void;
		onZoneDragLeave: (e: DragEvent) => void;
	}

	let { onFilesSelected, isDraggingOverZone, onZoneDragEnter, onZoneDragLeave }: Props = $props();

	const { config: configData } = useConfigQuery();

	let fileInputInitial = $state<HTMLInputElement>();
	let folderInputInitial = $state<HTMLInputElement>();

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

	const handleZoneDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const items = e.dataTransfer?.items;
		if (items) {
			const promises: Promise<File[]>[] = [];
			let folderName: string | undefined;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
				if (entry) {
					if (entry.isDirectory && !folderName) {
						folderName = entry.name;
					}
					promises.push(traverseFileTree(entry));
				} else if (item.kind === 'file') {
					const file = item.getAsFile();
					if (file) promises.push(Promise.resolve([file]));
				}
			}
			const fileArrays = await Promise.all(promises);
			const newFiles = fileArrays.flat();
			if (newFiles.length > 0) {
				onFilesSelected(newFiles, folderName);
			}
		} else if (e.dataTransfer?.files) {
			onFilesSelected(Array.from(e.dataTransfer.files));
		}
	};

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			onFilesSelected(Array.from(target.files));
		}
		target.value = '';
	};

	const handleFolderSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			const filesArray = Array.from(target.files);
			if (filesArray.length > 0) {
				// The first file's webkitRelativePath starts with the folder name
				const relativePath = (filesArray[0] as any).webkitRelativePath;
				const folderName = relativePath ? relativePath.split('/')[0] : undefined;
				onFilesSelected(filesArray, folderName);
			}
		}
		target.value = '';
	};
</script>

<div
	class={[
		'relative flex h-full cursor-pointer flex-col items-center justify-center rounded-lg bg-card transition-all duration-200 focus:outline-none',
		isDraggingOverZone && 'scale-[1.02] shadow-xl'
	]}
	ondrop={handleZoneDrop}
	onclick={() => fileInputInitial?.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fileInputInitial?.click();
		}
	}}
	ondragenter={onZoneDragEnter}
	ondragleave={onZoneDragLeave}
	tabindex="0"
	role="button"
	aria-label="File drop area - click or drop files to upload"
>
	<!-- Main content container -->
	<div class="relative z-10 flex flex-col items-center justify-center p-12">
		<!-- Plus icon in circle -->
		<div
			class={[
				'mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary transition-all duration-200',
				isDraggingOverZone && 'scale-110 bg-primary/10'
			]}
		>
			<Plus class="h-8 w-8 text-primary transition-transform duration-200" />
		</div>

		<!-- Text content -->
		<h2
			class={[
				'mb-2 text-xl font-medium transition-colors duration-200',
				isDraggingOverZone && 'text-primary'
			]}
		>
			Drag and drop files
		</h2>
		<p
			class={[
				'mb-8 text-center transition-colors duration-200 md:mb-4 md:text-sm',
				isDraggingOverZone ? 'text-primary/80' : 'text-muted-foreground'
			]}
		>
			or click to send up to {formatFileSize(configData.data?.max_file_size_limit ?? 0)} of files with
			end-to-end encryption
		</p>

		<!-- Buttons container -->
		<div class="flex flex-col gap-3">
			<Button
				variant="default"
				size="lg"
				class={[
					'cursor-pointer px-8 py-6 text-lg transition-all duration-200 md:px-6 md:py-4 md:text-base',
					isDraggingOverZone && 'scale-105 shadow-lg'
				]}
				onclick={(e) => {
					e.stopPropagation();
					fileInputInitial?.click();
				}}
			>
				Select files to upload
			</Button>

			<Button
				variant="outline"
				size="lg"
				class="cursor-pointer px-8 py-6 text-lg transition-all duration-200 md:px-6 md:py-4 md:text-base"
				onclick={(e) => {
					e.stopPropagation();
					folderInputInitial?.click();
				}}
			>
				Select folder to upload
			</Button>
		</div>

		<!-- Hidden file inputs -->
		<input
			bind:this={fileInputInitial}
			type="file"
			id="file-input-initial"
			class="hidden"
			multiple
			onchange={handleFileSelect}
		/>
		<input
			bind:this={folderInputInitial}
			type="file"
			id="file-input-folder"
			class="hidden"
			webkitdirectory
			directory
			onchange={handleFolderSelect}
		/>
	</div>

	<!-- Border elements -->
	<svg class="pointer-events-none absolute inset-0 h-full w-full rounded-lg">
		<rect
			width="100%"
			height="100%"
			rx="8"
			ry="8"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class={['text-border transition-all duration-200', isDraggingOverZone && 'animate-dash']}
			stroke-dasharray="10"
		/>
	</svg>
</div>
