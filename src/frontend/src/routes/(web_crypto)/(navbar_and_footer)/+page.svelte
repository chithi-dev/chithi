<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { useConfigQuery } from '$lib/queries/config';
	import { Plus, X, FileIcon, Eye, EyeOff, Trash2 } from 'lucide-svelte';
	import { marked } from '$lib/functions/marked';
	import { formatFileSize } from '$lib/functions/bytes';
	import { formatSeconds } from '$lib/functions/times';
	import { createTar } from '$lib/functions/tar';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { v7 as uuidv7 } from 'uuid';
	import { BACKEND_API } from '$lib/consts/backend';
	import { gzipBlob } from '$lib/functions/compression';
	import { encryptBlobWithHKDF } from '$lib/functions/encryption';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';

	const { config: configData } = useConfigQuery();

	let isDragging = $state(false);
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
	let renderedDetails = $derived(marked.parse(configData.data?.site_description ?? ''));

	$effect(() => {
		const total = files.reduce((sum, file) => sum + file.size, 0);
		totalSize = formatFileSize(total);
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

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		if (!isDragging) isDragging = true;
	};

	const handleDragLeave = (e: DragEvent) => {
		const currentTarget = e.currentTarget as Node;
		const relatedTarget = e.relatedTarget as Node;
		if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
			return;
		}
		isDragging = false;
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
				alert(
					`Total file size cannot exceed ${formatFileSize(configData.data.max_file_size_limit)}`
				);
				return;
			}
		}

		files = [...files, ...newFiles];
		if (files.length > 0) {
			isUploading = true;
		}
	};

	const handleDrop = async (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;

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
	};

	const handleUpload = async () => {
		if (files.length === 0) return;
		isUploading = true;
		try {
			const tar = await createTar(files);

			// Prefer gzipped archive when available
			let blobToUpload: Blob = tar;
			try {
				const gz = await gzipBlob(tar);
				blobToUpload = gz;
			} catch (gzErr: any) {
				console.warn('Gzip not available; uploading uncompressed tar', gzErr);
			}

			// Encrypt the (gzipped) blob using AES-256-GCM + HKDF-SHA-256
			const encRes = await encryptBlobWithHKDF(
				blobToUpload,
				isPasswordProtected ? password : undefined
			);

			// Use a v7 UUID as the filename (no extension)
			const filename = uuidv7();
			const form = new FormData();
			form.append('file', encRes.ciphertext, filename);
			// include encryption metadata so server can store it alongside the blob
			form.append('meta', JSON.stringify(encRes.meta));
			// include some other metadata if set
			form.append('download_limit', downloadLimit);
			form.append('time_limit', timeLimit);

			// Upload using XHR so we can track progress
			uploadProgress = 0;
			uploadingInProgress = true;
			const resText = await new Promise<string>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', `${BACKEND_API}/upload`);
				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						uploadProgress = Math.round((e.loaded / e.total) * 100);
					} else {
						// Unknown total — nudge the progress bar slowly
						uploadProgress = Math.min(99, uploadProgress + 1);
					}
				};
				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve(xhr.responseText);
					} else {
						reject(
							new Error(`Upload failed: ${xhr.status} ${xhr.statusText} ${xhr.responseText || ''}`)
						);
					}
				};
				xhr.onerror = () => reject(new Error('Network error during upload'));
				xhr.send(form);
			});

			uploadProgress = 100;
			uploadingInProgress = false;

			// Success — show simple confirmation, display the key fragment (keep secret client-side), and clear files
			const data = (() => {
				try {
					return JSON.parse(resText);
				} catch (e) {
					return null;
				}
			})();
			const serverPath =
				data && (data.id || data.path || data.key) ? data.id || data.path || data.key : null;
			let message = 'Upload successful.';
			if (serverPath) {
				message = `Upload successful: ${serverPath}#${encRes.keySecret}`;
			} else if (data) {
				message =
					'Upload successful: ' + JSON.stringify(data) + ` (key fragment: ${encRes.keySecret})`;
			} else {
				message = `Upload successful. Key fragment: ${encRes.keySecret}`;
			}
			alert(message);
			clearAllFiles();
		} catch (err: any) {
			console.error('Upload failed', err);
			alert('Upload failed: ' + (err?.message ?? err));
		} finally {
			isUploading = false;
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

<!-- Main Content -->
<main class="relative flex flex-1 items-center justify-center overflow-hidden p-4">
	<div class="absolute inset-0 z-0 overflow-hidden bg-slate-50 dark:bg-zinc-950">
		<!-- Rotating Beams -->
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>
		<div
			class="absolute top-1/2 left-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 animate-[spin_50s_linear_infinite_reverse] opacity-20"
		>
			<div
				class="absolute inset-0 bg-[conic-gradient(from_180deg,transparent_0deg,var(--primary)_60deg,transparent_120deg)] opacity-10 blur-3xl"
			></div>
		</div>

		<!-- Blobs -->
		<div
			class="absolute -top-[20%] -left-[20%] h-160 w-160 animate-blob rounded-full bg-purple-300/40 mix-blend-multiply blur-[100px] filter dark:bg-purple-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute top-[10%] -right-[20%] h-140 w-140 animate-blob rounded-full bg-yellow-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:2s] dark:bg-indigo-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="absolute -bottom-[20%] left-[20%] h-180 w-180 animate-blob rounded-full bg-pink-300/40 mix-blend-multiply blur-[100px] filter [animation-delay:4s] dark:bg-blue-900/40 dark:mix-blend-hard-light"
		></div>

		<!-- Grid with Pulse -->
		<div
			class="absolute inset-0 animate-pulse-slow bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"
		></div>

		<!-- Floating Particles & Stars -->
		<div class="absolute inset-0 overflow-hidden">
			<div
				class="absolute top-[20%] left-[10%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="absolute top-[60%] right-[15%] h-3 w-3 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[10%] left-[30%] h-2 w-2 animate-float rounded-full bg-primary/20 blur-[1px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[30%] right-[40%] h-1.5 w-1.5 animate-float rounded-full bg-primary/30 blur-[1px] [animation-delay:5s]"
			></div>

			<!-- Twinkling Stars -->
			<div
				class="absolute top-[15%] left-[25%] h-1 w-1 animate-twinkle rounded-full bg-yellow-200/60 blur-[0.5px]"
			></div>
			<div
				class="absolute top-[35%] right-[25%] h-1.5 w-1.5 animate-twinkle rounded-full bg-blue-200/60 blur-[0.5px] [animation-delay:2s]"
			></div>
			<div
				class="absolute bottom-[25%] left-[45%] h-1 w-1 animate-twinkle rounded-full bg-purple-200/60 blur-[0.5px] [animation-delay:4s]"
			></div>
			<div
				class="absolute top-[10%] right-[10%] h-0.5 w-0.5 animate-twinkle rounded-full bg-white/60 blur-[0.5px] [animation-delay:5s]"
			></div>
		</div>

		<!-- Noise Overlay -->
		<div class="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay">
			<svg class="h-full w-full">
				<filter id="noise">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.8"
						numOctaves="3"
						stitchTiles="stitch"
					/>
				</filter>
				<rect width="100%" height="100%" filter="url(#noise)" />
			</svg>
		</div>

		<!-- Vignette -->
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-slate-50)_100%)] opacity-60 dark:bg-[radial-gradient(circle_at_center,transparent_30%,var(--color-zinc-950)_100%)]"
		></div>
	</div>
	<Card
		class="relative z-10 mx-auto w-full max-w-6xl border-border bg-card shadow-[0_0_15px_-12px_var(--primary)] transition-all duration-200 {isDragging
			? 'shadow-[0_0_40px_-10px_var(--primary)]'
			: ''}"
		ondragover={handleDragOver}
		ondragenter={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<CardContent class="p-6">
			{#if configData.isLoading}
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<div
						class="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12"
					>
						<Skeleton class="mb-6 h-16 w-16 rounded-full" />
						<Skeleton class="mb-2 h-8 w-48" />
						<Skeleton class="mb-8 h-4 w-64" />
						<Skeleton class="h-14 w-56 rounded-md" />
					</div>
					<div class="flex flex-col space-y-4 p-2 lg:p-8">
						<Skeleton class="h-8 w-3/4" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-2/3" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-5/6" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-4/5" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-5/6" />
					</div>
				</div>
			{:else if isUploading}
				<!-- Upload Interface -->
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Left Column: File List and Controls -->
					<div class="flex flex-col pb-2">
						<!-- File List -->
						<div class="mb-2 flex justify-end">
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
						<ScrollArea class="mb-4 max-h-72 w-full rounded-lg border border-border bg-card">
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
						{#if uploadingInProgress}
							<div class="mt-3">
								<Progress value={uploadProgress} />
							</div>
						{/if}
					</div>

					<div class="flex flex-col justify-center p-4 lg:p-8">
						<h2 class="mb-4 text-2xl font-bold md:mb-2 md:text-xl lg:mb-6 lg:text-3xl">
							End-to-End Encryption
						</h2>
						<p
							class="mb-6 text-muted-foreground md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed"
						>
							Your files are encrypted in your browser before they are ever uploaded. This means
							only you and the people you share the link with can access them. We cannot see your
							files.
						</p>
						<div class="rounded-xl border border-border bg-muted/50 p-4 md:p-3 lg:p-5">
							<h3 class="mb-2 font-semibold">How it works</h3>
							<p class="text-sm text-muted-foreground">
								A unique key is generated for each upload. This key is used to encrypt your files
								and is included in the share link after the '#' symbol. The server never receives
								this key.
							</p>
						</div>
					</div>
				</div>
			{:else}
				<!-- Initial Drop Area -->
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Left Column: Drop Area -->
					<div
						class="relative flex h-full cursor-pointer flex-col items-center justify-center rounded-lg bg-card transition-all duration-200 focus:outline-none"
						onclick={() => fileInputInitial?.click()}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								fileInputInitial?.click();
							}
						}}
						tabindex="0"
						role="button"
						aria-label="File drop area - click or drop files to upload"
					>
						<!-- Main content container -->
						<div class="relative z-10 flex flex-col items-center justify-center p-12">
							<!-- Plus icon in circle -->
							<div
								class="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary transition-opacity duration-200 {isDragging
									? 'opacity-40'
									: 'opacity-100'}"
							>
								<Plus
									class="h-8 w-8 text-primary transition-opacity duration-200 {isDragging
										? 'opacity-40'
										: 'opacity-100'}"
								/>
							</div>

							<!-- Text content -->
							<h2
								class="mb-2 text-xl font-medium transition-opacity duration-200 {isDragging
									? 'opacity-40'
									: 'opacity-100'}"
							>
								Drag and drop files
							</h2>
							<p
								class="mb-8 text-center text-muted-foreground transition-opacity duration-200 md:mb-4 md:text-sm {isDragging
									? 'opacity-40'
									: 'opacity-100'}"
							>
								or click to send up to {formatFileSize(configData.data?.max_file_size_limit ?? 0)} of
								files with end-to-end encryption
							</p>

							<!-- Button -->
							<Button
								variant="default"
								size="lg"
								class="cursor-pointer px-8 py-6 text-lg transition-opacity duration-200 md:px-6 md:py-4 md:text-base {isDragging
									? 'opacity-40'
									: 'opacity-100'}"
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
								class="text-border transition-all duration-200 {isDragging
									? 'animate-dash text-primary'
									: ''}"
								stroke-dasharray="10"
							/>
						</svg>
					</div>

					<!-- Right Column: Info -->
					<div class="flex flex-col justify-between p-2 lg:p-8">
						<div
							class="prose mb-6 max-w-none prose-zinc md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed dark:prose-invert"
						>
							{@html renderedDetails}
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</main>
