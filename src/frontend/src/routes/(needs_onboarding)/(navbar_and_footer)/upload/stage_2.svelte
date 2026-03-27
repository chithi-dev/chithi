<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { useConfigQuery } from '#queries/config';
	import { Plus, ArrowLeft, X, FileIcon, Eye, EyeOff, Trash2, Upload } from 'lucide-svelte';
	import { formatFileSize } from '#functions/bytes';
	import { formatSeconds } from '#functions/times';
	import { createZipStream, createEncryptedStream } from '#functions/streams';
	import * as Tooltip from '$lib/components/ui/tooltip/index';
	import { v7 as uuidv7 } from 'uuid';
	import { Api } from '#consts/backend';
	import { Progress } from '$lib/components/ui/progress';
	import { addHistoryEntry } from '$lib/database';
	import { toast } from 'svelte-sonner';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';

	interface Props {
		files: File[];
		onFilesUpdated: (files: File[]) => void;
		onUploadComplete: (result: {
			finalLink: string;
			viewOnceLink: string;
			isViewOnce: boolean;
		}) => void;
		onBack: () => void;
		isDraggingOverZone: boolean;
		onZoneDragEnter: (e: DragEvent) => void;
		onZoneDragLeave: (e: DragEvent) => void;
	}

	let {
		files = $bindable(),
		onFilesUpdated,
		onUploadComplete,
		onBack,
		isDraggingOverZone,
		onZoneDragEnter,
		onZoneDragLeave
	}: Props = $props();

	const { config: configData } = useConfigQuery();

	let fileInput = $state<HTMLInputElement>();

	// Flattened settings
	let downloadLimit = $state('1');
	let timeLimit = $state('86400');
	let isPasswordProtected = $state(false);
	let password = $state('');
	let showPassword = $state(false);
	let folderName = $state(uuidv7());
	let defaultsLoaded = $state(false);

	// Flattened status
	let inProgress = $state(false);
	let isEncrypting = $state(false);
	let encryptionProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));
	let uploadProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));

	const totalSize = $derived(formatFileSize(files.reduce((sum, file) => sum + file.size, 0)));

	$effect(() => {
		if (files.length === 1) {
			folderName = files[0].name;
		} else if (files.length === 0) {
			folderName = uuidv7();
		}
	});

	$effect(() => {
		if (configData.data && !defaultsLoaded) {
			downloadLimit = configData.data.default_number_of_downloads?.toString() ?? downloadLimit;
			timeLimit = configData.data.default_expiry?.toString() ?? timeLimit;
			defaultsLoaded = true;
		}
	});

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

	const addFiles = (newFiles: File[]) => {
		const currentTotalSize = files.reduce((sum, file) => sum + file.size, 0);
		const newFilesSize = newFiles.reduce((sum, file) => sum + file.size, 0);

		if (
			configData.data?.max_file_size_limit &&
			currentTotalSize + newFilesSize > configData.data.max_file_size_limit
		) {
			toast.error(
				`Total file size cannot exceed ${formatFileSize(configData.data.max_file_size_limit)}`
			);
			return;
		}

		files = [...files, ...newFiles];
		onFilesUpdated(files);
	};

	const handleZoneDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onZoneDragLeave(e);

		const items = e.dataTransfer?.items;
		if (items) {
			const promises = Array.from(items).map((item) => {
				const entry = (item as any).webkitGetAsEntry?.();
				return entry
					? traverseFileTree(entry)
					: item.kind === 'file'
						? Promise.resolve([item.getAsFile()].filter(Boolean) as File[])
						: Promise.resolve([]);
			});
			const fileArrays = await Promise.all(promises);
			const newFiles = fileArrays.flat();
			newFiles.length > 0 && addFiles(newFiles);
		} else if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	};

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			addFiles(Array.from(target.files));
		}
		target.value = '';
	};

	const removeFile = (file: File) => {
		files = files.filter((f) => f !== file);
		onFilesUpdated(files);
		files.length === 0 && onBack();
	};

	const clearAllFiles = () => {
		files = [];
		onFilesUpdated(files);
		onBack();
	};

	const handleUpload = async (viewOnce = false) => {
		if (files.length === 0) return;
		if (viewOnce && files.length !== 1) {
			toast.error('View Once only supports a single file');
			return;
		}

		try {
			inProgress = true;
			uploadProgress = new Tween(0, { duration: 500, easing: cubicOut });

			// Create Zip Stream
			const stream = await createZipStream(files, isPasswordProtected ? password : undefined);

			//  Encrypt
			const currentTotalSize = files.reduce((sum, file) => sum + file.size, 0);
			// start encryption progress reporting
			isEncrypting = true;
			encryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
			const { stream: encryptedStream, keySecret } = await createEncryptedStream(
				stream,
				isPasswordProtected ? password : undefined,
				currentTotalSize,
				(processed, total) => {
					if (total && total > 0) {
						encryptionProgress.target = Math.min(100, Math.round((processed / total) * 100));
					} else {
						encryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
					}
				}
			);

			// Upload
			const readableFilename = files.length === 1 ? files[0].name : folderName;
			const blobFilename = uuidv7();
			const encryptedBlob = await new Response(encryptedStream).blob();
			// ensure encryption progress completes
			isEncrypting = false;
			encryptionProgress.target = 100;

			const formData = new FormData();
			formData.append('filename', readableFilename);
			formData.append('expire_after_n_download', viewOnce ? '1' : downloadLimit);
			formData.append('expire_after', timeLimit);
			formData.append('file', encryptedBlob, blobFilename);
			files.length > 1 && formData.append('folder_name', folderName);

			const data = await new Promise<any>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', Api.UPLOAD);

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						uploadProgress.target = Math.round((e.loaded / e.total) * 100);
					} else {
						// fallback to visible progress when total is unknown
						uploadProgress.target = Math.min(99, uploadProgress.target + 1);
					}
				};

				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						try {
							resolve(JSON.parse(xhr.responseText));
						} catch (e) {
							reject(new Error('Invalid JSON response'));
						}
					} else {
						reject(
							new Error(`Upload failed: ${xhr.status} ${xhr.statusText} ${xhr.responseText || ''}`)
						);
					}
				};

				xhr.onerror = () => reject(new Error('Network error during upload'));
				xhr.send(formData);
			});

			uploadProgress.target = 100;

			const serverPath = data?.id ?? data?.path ?? data?.key;

			if (!serverPath) throw new Error('Invalid server response');

			// Store the key in the URL fragment so it is never sent to the server
			const downloadPath = `/download/${serverPath}#${keySecret}`;
			const finalLink = `${window.location.origin}${downloadPath}`;
			const viewOnceLink = viewOnce
				? `${window.location.origin}/once/${serverPath}#${keySecret}`
				: '';

			// Add to history
			const expiryTime = Date.now() + parseInt(timeLimit) * 1000;
			const entryName = files.length === 1 ? files[0].name : folderName;

			addHistoryEntry({
				id: serverPath,
				name: entryName,
				link: viewOnce ? viewOnceLink : finalLink,
				expiry: expiryTime,
				downloadLimit: viewOnce ? '1' : downloadLimit,
				createdAt: Date.now(),
				size: totalSize
			});

			onUploadComplete({ finalLink, viewOnceLink, isViewOnce: viewOnce });
			toast.success(viewOnce ? 'View Once link created' : 'Upload complete');
		} catch (err: any) {
			console.error('Upload failed', err);
			toast.error('Upload failed: ' + (err?.message ?? err));
			inProgress = false;
			uploadProgress = new Tween(0, { duration: 500, easing: cubicOut });
			isEncrypting = false;
			encryptionProgress = new Tween(0, { duration: 500, easing: cubicOut });
		} finally {
			inProgress = false;
			isEncrypting = false;
		}
	};
</script>

{#snippet fileItem(file: File)}
	<div
		class="flex items-center justify-between border-b border-border py-2 first:pt-0 last:border-0"
	>
		<div class="flex items-center gap-3">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
				<FileIcon class="h-4 w-4 text-primary" />
			</div>
			<div class="flex flex-col gap-0.5">
				<div class="text-sm leading-none font-medium">{file.name}</div>
				<div class="text-xs text-foreground">
					{#if (file as any).relativePath}
						<span class="block max-w-50 truncate text-xs opacity-70"
							>{(file as any).relativePath}</span
						>
					{/if}
					{formatFileSize(file.size)}
				</div>
			</div>
		</div>
		<Button
			variant="ghost"
			onclick={() => removeFile(file)}
			class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<X class="h-4 w-4" />
		</Button>
	</div>
{/snippet}

{#if inProgress}
	<!-- Modern Upload Animation -->
	<div class="flex h-full w-full flex-col items-center justify-center p-8">
		<div class="relative mb-8 flex h-40 w-40 items-center justify-center">
			<!-- Background Layers -->
			<div class="absolute inset-0 animate-pulse rounded-full bg-primary/5"></div>

			<!-- Static Track -->
			<div class="absolute inset-0 rounded-full border-4 border-muted/20"></div>

			<!-- Dynamic Rings -->
			<div
				class="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary shadow-[0_0_15px_-3px_var(--primary)]"
				style="animation-duration: 1.5s; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);"
			></div>

			<div
				class="absolute inset-3 animate-spin rounded-full border-4 border-transparent border-t-primary/70 border-r-primary/30"
				style="animation-duration: 2s; animation-direction: reverse; animation-timing-function: linear;"
			></div>

			<!-- Center Icon -->
			<div class="relative z-10">
				<Upload class="h-12 w-12 text-primary drop-shadow-md" />
			</div>
		</div>

		<h3 class="mb-2 text-2xl font-semibold tracking-tight">Encrypting & Uploading...</h3>
		<p class="mb-8 text-muted-foreground">Please wait while we secure your files</p>

		<div class="w-full max-w-md space-y-3">
			{#if isEncrypting}
				<Progress value={encryptionProgress.current} class="h-2" />
				<div class="flex justify-between text-xs font-medium text-muted-foreground">
					<span>Encrypting {Math.round(encryptionProgress.current)}%</span>
					<span>{totalSize}</span>
				</div>
			{:else}
				<Progress value={uploadProgress.current} class="h-2" />
				<div class="flex justify-between text-xs font-medium text-muted-foreground">
					<span>{Math.round(uploadProgress.current)}%</span>
					<span>{totalSize}</span>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<!-- Upload Interface -->
	<!-- Left Column: File List and Controls -->
	<div class="flex h-full w-full flex-col pb-2">
		<!-- File List with Back button on the left -->
		<div class="mb-2 flex items-center justify-between gap-2">
			<div>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button variant="ghost" size="sm" class="mb-2" onclick={onBack}>
								<ArrowLeft class="mr-2 h-4 w-4" />
								Back
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content>Return to file selection (stage 1)</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>

			<div class="flex items-center gap-2">
				{#if files.length > 1}
					<Input bind:value={folderName} class="h-8 w-48" placeholder="Folder Name" />
				{/if}
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger
							class={`${buttonVariants({ variant: 'ghost' })} cursor-pointer`}
							onclick={clearAllFiles}
						>
							<Trash2 class="h-4 w-4" />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Clear all files</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>
		<ScrollArea
			class={[
				'mb-4 h-60 max-h-[45vh] w-full rounded-lg border border-border bg-card transition-colors lg:max-h-[50vh] lg:flex-1',
				isDraggingOverZone && 'bg-primary/5'
			]}
			ondragenter={onZoneDragEnter}
			ondragleave={onZoneDragLeave}
			ondragover={(e) => e.preventDefault()}
			ondrop={handleZoneDrop}
		>
			<div class="p-4">
				{#each files as file}
					{@render fileItem(file)}
				{/each}
			</div>
		</ScrollArea>

		<!-- Controls -->
		<div class="mb-4 flex items-center">
			<button
				class="flex cursor-pointer items-center text-sm text-primary hover:underline"
				onclick={() => fileInput?.click()}
			>
				<Plus class="mr-1 h-4 w-4" />
				Select files to upload
			</button>
			<input
				bind:this={fileInput}
				type="file"
				id="file-input"
				class="hidden"
				multiple
				onchange={handleFileSelect}
			/>
			<div class="ml-auto text-sm text-muted-foreground">Total size: {totalSize}</div>
		</div>

		<!-- Expiry and Password Options -->
		<div class="mb-4 space-y-2">
			<div class="flex items-center">
				<span class="text-sm">Expires after</span>
				<Select.Root type="single" bind:value={downloadLimit}>
					<Select.Trigger class="ml-2 w-35">
						{downloadLimit}
						{downloadLimit === '1' ? 'download' : 'downloads'}
					</Select.Trigger>
					<Select.Content>
						{#if configData.data?.download_configs}
							{#each configData.data.download_configs as limit}
								<Select.Item value={limit.toString()}
									>{limit} {limit === 1 ? 'download' : 'downloads'}</Select.Item
								>
							{/each}
						{:else}
							<Select.Item value="1">1 download</Select.Item>
						{/if}
					</Select.Content>
				</Select.Root>
				<span class="mx-2 text-sm">or</span>
				<Select.Root type="single" bind:value={timeLimit}>
					<Select.Trigger class="w-35">
						{@const { val, unit } = formatSeconds(parseInt(timeLimit))}
						{val}
						{val === 1 ? unit.slice(0, -1) : unit}
					</Select.Trigger>
					<Select.Content>
						{#if configData.data?.time_configs}
							{#each configData.data.time_configs as time}
								{@const { val, unit } = formatSeconds(time)}
								<Select.Item value={time.toString()}>
									{val}
									{val === 1 ? unit.slice(0, -1) : unit}
								</Select.Item>
							{/each}
						{:else}
							<Select.Item value="86400">1 Day</Select.Item>
						{/if}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex h-9 items-center gap-2">
				<div class="flex items-center">
					<input
						type="checkbox"
						id="password"
						bind:checked={isPasswordProtected}
						class="mr-2 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
					/>
					<label
						for="password"
						class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>Protect with password</label
					>
				</div>
				{#if isPasswordProtected}
					<div class="relative max-w-xs flex-1">
						<Input
							type={showPassword ? 'text' : 'password'}
							placeholder="Password"
							bind:value={password}
							class="h-9 pr-10"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>

		<Button
			class="w-full cursor-pointer"
			onclick={() => handleUpload(false)}
			disabled={files.length === 0}>Upload</Button
		>
		{#if files.length === 1}
			<Button variant="outline" class="w-full cursor-pointer" onclick={() => handleUpload(true)}>
				<Eye class="mr-2 size-4" /> View Once
			</Button>
		{:else}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button variant="outline" class="w-full" disabled>
							<Eye class="mr-2 size-4" /> View Once
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>View Once requires exactly one file</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>
{/if}

