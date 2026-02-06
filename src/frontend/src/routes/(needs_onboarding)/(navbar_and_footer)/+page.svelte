<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { useConfigQuery } from '#queries/config';
	import {
		Plus,
		X,
		FileIcon,
		Eye,
		EyeOff,
		Trash2,
		Check,
		Copy,
		Lock,
		Upload,
		Download
	} from 'lucide-svelte';
	import { formatFileSize } from '#functions/bytes';
	import { formatSeconds } from '#functions/times';
	import { createZipStream, createEncryptedStream } from '#functions/streams';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { v7 as uuidv7 } from 'uuid';
	import { BACKEND_API } from '$lib/consts/backend';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import QRCode from '$lib/components/QRCode.svelte';
	import RecentUpload from './recent_upload.svelte';
	import { addHistoryEntry } from '$lib/database';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import { dev } from '$app/environment';
	import { html_to_markdown } from '$lib/markdown/markdown';

	const { config: configData } = useConfigQuery();

	let isDragging = $state(false);
	let isDraggingOverCard = $state(false);
	let isDraggingOverZone = $state(false);
	let dragCounter = 0;
	let files: File[] = $state([]);
	let isUploading = $state(false);
	let totalSize = $state('0 Bytes');
	let fileInputInitial = $state<HTMLInputElement>();
	let fileInput = $state<HTMLInputElement>();
	let downloadLimit = $state('1');
	let defaultDownloadLimitSet = false;
	let timeLimit = $state('86400');
	let defaultTimeLimitSet = false;
	let isPasswordProtected = $state(false);
	let password = $state('');
	let showPassword = $state(false);
	let uploadProgress = $state(0);
	let uploadingInProgress = $state(false);
	let isUploadComplete = $state(false);
	let finalLink = $state('');
	let isCopied = $state(false);
	let debugLoading = $state(false);
	let folderName = $state(uuidv7());

	// Encryption progress states
	let encryptionProgress = $state(0);
	let isEncrypting = $state(false);
	let markdownDetails = $derived(configData.data?.site_description ?? '');

	$effect(() => {
		const total = files.reduce((sum, file) => sum + file.size, 0);
		totalSize = formatFileSize(total);
		if (files.length === 1) {
			folderName = files[0].name;
		} else if (files.length === 0) {
			folderName = uuidv7();
		}
	});

	$effect(() => {
		if (configData.data?.default_number_of_downloads && !defaultDownloadLimitSet) {
			downloadLimit = configData.data.default_number_of_downloads.toString();
			defaultDownloadLimitSet = true;
		}
	});

	$effect(() => {
		if (configData.data?.default_expiry && !defaultTimeLimitSet) {
			timeLimit = configData.data.default_expiry.toString();
			defaultTimeLimitSet = true;
		}
	});

	const handleWindowDragEnter = (e: DragEvent) => {
		e.preventDefault();
		dragCounter++;
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		isDragging = true;
	};

	const handleWindowDragLeave = (e: DragEvent) => {
		dragCounter--;
		if (dragCounter <= 0) {
			isDragging = false;
			dragCounter = 0;
		}
	};

	const handleWindowDragOver = (e: DragEvent) => {
		e.preventDefault();
		if (!isDragging) isDragging = true;
	};

	const handleWindowDrop = (e: DragEvent) => {
		e.preventDefault();
		dragCounter = 0;
		isDragging = false;
		isDraggingOverZone = false;
		isDraggingOverCard = false;
		if (e.dataTransfer?.types.includes('Files')) {
			toast.error('File/folder must be dropped into the bordered area in the dashed circle');
		}
	};

	const handleCardDragEnter = (e: DragEvent) => {
		e.preventDefault();
		isDraggingOverCard = true;
	};

	const handleCardDragLeave = (e: DragEvent) => {
		const currentTarget = e.currentTarget as Node;
		const relatedTarget = e.relatedTarget as Node;
		if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
			return;
		}
		isDraggingOverCard = false;
	};

	const handleZoneDragEnter = (e: DragEvent) => {
		e.preventDefault();
		isDraggingOverZone = true;
	};

	const handleZoneDragLeave = (e: DragEvent) => {
		const currentTarget = e.currentTarget as Node;
		const relatedTarget = e.relatedTarget as Node;
		if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
			return;
		}
		isDraggingOverZone = false;
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

	const addFiles = (newFiles: File[]) => {
		const currentTotalSize = files.reduce((sum, file) => sum + file.size, 0);
		const newFilesSize = newFiles.reduce((sum, file) => sum + file.size, 0);

		if (configData.data?.max_file_size_limit) {
			if (currentTotalSize + newFilesSize > configData.data.max_file_size_limit) {
				toast.error(
					`Total file size cannot exceed ${formatFileSize(configData.data.max_file_size_limit)}`
				);
				return;
			}
		}

		const wasSingleFile = files.length === 1;
		files = [...files, ...newFiles];
		if (wasSingleFile && files.length > 1) {
			folderName = uuidv7();
		}
		if (files.length > 0) {
			isUploading = true;
			isUploadComplete = false;
		}
	};

	const handleZoneDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
		isDraggingOverZone = false;
		isDraggingOverCard = false;
		dragCounter = 0;

		const items = e.dataTransfer?.items;
		if (items) {
			const promises: Promise<File[]>[] = [];
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
				if (entry) {
					promises.push(traverseFileTree(entry));
				} else if (item.kind === 'file') {
					const file = item.getAsFile();
					if (file) promises.push(Promise.resolve([file]));
				}
			}
			const fileArrays = await Promise.all(promises);
			const newFiles = fileArrays.flat();
			if (newFiles.length > 0) {
				addFiles(newFiles);
			}
		} else if (e.dataTransfer?.files) {
			addFiles(Array.from(e.dataTransfer.files));
		}
	};

	const handleCardDrop = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;
		isDraggingOverZone = false;
		isDraggingOverCard = false;
		dragCounter = 0;
		toast.error('File/Folder must be dropped in the bordered area');
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
		if (files.length === 0) {
			isUploading = false;
		}
	};

	const clearAllFiles = () => {
		files = new Array<(typeof files)[0]>();
		isUploading = false;
		isUploadComplete = false;
		finalLink = '';
		folderName = uuidv7();
	};

	const copyLink = () => {
		navigator.clipboard.writeText(finalLink);
		isCopied = true;
		toast.success('Copied the link successfully');
		setTimeout(() => (isCopied = false), 2000);
	};

	const handleUpload = async () => {
		if (files.length === 0) return;
		// isUploading is already true
		try {
			uploadingInProgress = true;
			uploadProgress = 0;

			// Create Zip Stream
			const stream = await createZipStream(files, isPasswordProtected ? password : undefined);

			//  Encrypt
			const currentTotalSize = files.reduce((sum, file) => sum + file.size, 0);
			// start encryption progress reporting
			isEncrypting = true;
			encryptionProgress = 0;
			const { stream: encryptedStream, keySecret } = await createEncryptedStream(
				stream,
				isPasswordProtected ? password : undefined,
				currentTotalSize,
				(processed, total) => {
					if (total && total > 0) {
						encryptionProgress = Math.min(100, Math.round((processed / total) * 100));
					} else {
						encryptionProgress = 0;
					}
				}
			);

			// Upload
			// send a readable filename (original file name or folder name) and a generated blob filename
			const readableFilename = files.length === 1 ? files[0].name : folderName;
			const blobFilename = uuidv7();
			const encryptedBlob = await new Response(encryptedStream).blob();
			// ensure encryption progress completes
			isEncrypting = false;
			encryptionProgress = 100;

			const formData = new FormData();
			formData.append('filename', readableFilename);
			formData.append('expire_after_n_download', downloadLimit);
			formData.append('expire_after', timeLimit);
			formData.append('file', encryptedBlob, blobFilename);
			if (files.length > 1) {
				formData.append('folder_name', folderName);
			}

			const data = await new Promise<any>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', `${BACKEND_API}/upload`);

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						uploadProgress = Math.round((e.loaded / e.total) * 100);
					} else {
						// fallback to visible progress when total is unknown
						uploadProgress = Math.min(99, uploadProgress + 1);
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

			uploadProgress = 100;

			const serverPath =
				data && (data.id || data.path || data.key) ? data.id || data.path || data.key : null;

			if (!serverPath) throw new Error('Invalid server response');

			// Store the key in the URL fragment so it is never sent to the server
			const downloadPath = `/download/${serverPath}#${keySecret}`;
			finalLink = `${window.location.origin}${downloadPath}`;
			isUploadComplete = true;
			isUploading = false;

			// Add to history (use server key/id so it matches remote resource)
			const expiryTime = Date.now() + parseInt(timeLimit) * 1000;
			const entryName = files.length === 1 ? files[0].name : folderName;

			addHistoryEntry({
				id: serverPath,
				name: entryName,
				link: finalLink,
				expiry: expiryTime,
				downloadLimit: downloadLimit,
				createdAt: Date.now(),
				size: totalSize
			});

			// copy link and show success toast
			navigator.clipboard.writeText(finalLink);
			isCopied = true;
			setTimeout(() => (isCopied = false), 2000);
			toast.success('Upload complete');
		} catch (err: any) {
			console.error('Upload failed', err);
			toast.error('Upload failed: ' + (err?.message ?? err));
			// keep files so user can retry; reset upload progress and flags
			uploadingInProgress = false;
			uploadProgress = 0;
			// reset encryption state if error during encrypt
			isEncrypting = false;
			encryptionProgress = 0;
		} finally {
			uploadingInProgress = false;
			isEncrypting = false;
		}
	};
</script>

<svelte:window
	ondragenter={handleWindowDragEnter}
	ondragover={handleWindowDragOver}
	ondragleave={handleWindowDragLeave}
	ondrop={handleWindowDrop}
/>

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

<Card
	class={cn(
		'relative z-10 mx-auto w-full max-w-5xl border-border bg-card transition-all duration-200',
		isDragging && 'shadow-[0_0_20px_-10px_var(--primary)]',
		isDraggingOverCard && 'shadow-[0_0_40px_-10px_var(--primary)]',
		isDraggingOverZone && 'shadow-[0_0_60px_-10px_var(--primary)]'
	)}
	ondrop={handleCardDrop}
	ondragenter={handleCardDragEnter}
	ondragleave={handleCardDragLeave}
>
	<div class="absolute top-4 right-4 z-20">
		<RecentUpload />
	</div>
	<CardContent class="p-6">
		<div class="grid min-h-150 grid-cols-1 gap-8 lg:grid-cols-2">
			{#if configData.isLoading || (dev && debugLoading)}
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
			{:else if isUploadComplete}
				<!-- Final Success Screen -->
				<div
					class="col-span-1 flex h-full flex-col items-center justify-center py-12 text-center lg:col-span-2"
				>
					<div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
						<Lock class="h-10 w-10 text-green-500" />
					</div>
					<h2 class="mb-2 text-3xl font-bold tracking-tight">
						Your file is encrypted and ready to send
					</h2>
					<p class="mb-8 text-muted-foreground">Copy the link to share your file:</p>

					<div class="mb-8 flex w-full max-w-md items-center gap-2">
						<Input readonly value={finalLink} class="font-mono text-sm" />
					</div>

					<div class="mb-8 flex flex-col items-center gap-4">
						<div class="rounded-lg border bg-white p-2 dark:bg-white">
							<QRCode value={finalLink} size={180} color="#000000" backgroundColor="#ffffff" />
						</div>
					</div>

					<div class="flex gap-4">
						<Button onclick={copyLink} class="w-40 cursor-pointer">
							{#if isCopied}
								<Check class="mr-2 h-4 w-4" /> Copied
							{:else}
								<Copy class="mr-2 h-4 w-4" /> Copy link
							{/if}
						</Button>
						<Button variant="outline" href={finalLink} class="w-32 cursor-pointer">
							<Download class="mr-2 h-4 w-4" />
							Download
						</Button>
					</div>
				</div>
			{:else if isUploading}
				{#if uploadingInProgress}
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
								<Progress value={encryptionProgress} class="h-2" />
								<div class="flex justify-between text-xs font-medium text-muted-foreground">
									<span>Encrypting {encryptionProgress}%</span>
									<span>{totalSize}</span>
								</div>
							{:else}
								<Progress value={uploadProgress} class="h-2" />
								<div class="flex justify-between text-xs font-medium text-muted-foreground">
									<span>{uploadProgress}%</span>
									<span>{totalSize}</span>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Upload Interface -->
					<!-- Left Column: File List and Controls -->
					<div class="flex h-full w-full flex-col pb-2">
						<!-- File List -->
						<div class="mb-2 flex items-center justify-end gap-2">
							{#if files.length > 1}
								<Input bind:value={folderName} class="h-8 w-48" placeholder="Folder Name" />
							{/if}
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger
										class={`${buttonVariants({ variant: 'ghost' })} cursor-pointer`}
										onclick={() => {
											clearAllFiles();
										}}
									>
										<Trash2 class="h-4 w-4" />
									</Tooltip.Trigger>
									<Tooltip.Content>
										<p>Clear all files</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						</div>
						<ScrollArea
							class="mb-4 h-72 w-full rounded-lg border border-border bg-card lg:h-auto lg:flex-1"
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
							onclick={handleUpload}
							disabled={files.length === 0 || uploadingInProgress}>Upload</Button
						>
					</div>
				{/if}
			{:else}
				<!-- Initial Drop Area -->
				<!-- Left Column: Drop Area -->
				<div
					class={cn(
						'relative flex h-full cursor-pointer flex-col items-center justify-center rounded-lg bg-card transition-all duration-200 focus:outline-none',
						isDraggingOverZone && 'scale-[1.02] shadow-xl'
					)}
					ondrop={handleZoneDrop}
					onclick={() => fileInputInitial?.click()}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							fileInputInitial?.click();
						}
					}}
					ondragenter={handleZoneDragEnter}
					ondragleave={handleZoneDragLeave}
					tabindex="0"
					role="button"
					aria-label="File drop area - click or drop files to upload"
				>
					<!-- Main content container -->
					<div class="relative z-10 flex flex-col items-center justify-center p-12">
						<!-- Plus icon in circle -->
						<div
							class={cn(
								'mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary transition-all duration-200',
								isDraggingOverZone && 'scale-110 bg-primary/10'
							)}
						>
							<Plus class="h-8 w-8 text-primary transition-transform duration-200" />
						</div>

						<!-- Text content -->
						<h2
							class={cn(
								'mb-2 text-xl font-medium transition-colors duration-200',
								isDraggingOverZone && 'text-primary'
							)}
						>
							Drag and drop files
						</h2>
						<p
							class={cn(
								'mb-8 text-center transition-colors duration-200 md:mb-4 md:text-sm',
								isDraggingOverZone ? 'text-primary/80' : 'text-muted-foreground'
							)}
						>
							or click to send up to {formatFileSize(configData.data?.max_file_size_limit ?? 0)} of files
							with end-to-end encryption
						</p>

						<!-- Button -->
						<Button
							variant="default"
							size="lg"
							class={cn(
								'cursor-pointer px-8 py-6 text-lg transition-all duration-200 md:px-6 md:py-4 md:text-base',
								isDraggingOverZone && 'scale-105 shadow-lg'
							)}
							onclick={(e) => {
								e.stopPropagation();
								fileInputInitial?.click();
							}}
						>
							Select files to upload
						</Button>

						<!-- Hidden file input -->
						<input
							bind:this={fileInputInitial}
							type="file"
							id="file-input-initial"
							class="hidden"
							multiple
							onchange={handleFileSelect}
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
							class={cn(
								'text-border transition-all duration-200',
								isDragging && (isDraggingOverZone ? 'text-primary' : 'text-primary/50'),
								isDraggingOverZone && 'animate-dash'
							)}
							stroke-dasharray="10"
						/>
					</svg>
				</div>
			{/if}

			<!-- Right Column: Info -->
			{#if configData.isLoading || (dev && debugLoading)}
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
			{:else if !isUploadComplete && !isUploading}
				<div class="flex h-full w-full flex-col p-4 lg:p-8">
					<ScrollArea class="h-auto w-full lg:h-full">
						<div
							class="prose w-full max-w-none prose-zinc md:text-sm lg:text-lg lg:leading-relaxed dark:prose-invert"
						>
						{#await html_to_markdown(markdownDetails) then html}
							{@html html}
						{/await}
						</div>
					</ScrollArea>
				</div>
			{:else if !isUploadComplete}
				{@render encryptionInfo()}
			{/if}
		</div>
	</CardContent>
</Card>

{#if dev}
	<div class="fixed bottom-4 left-4 z-50">
		<Button onclick={() => (debugLoading = !debugLoading)}>Toggle Skeleton</Button>
	</div>
{/if}
