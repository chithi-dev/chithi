<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Bird, Plus, X, FileIcon } from 'lucide-svelte';

	let isDragging = $state(false);
	let files: File[] = $state([]);
	let isUploading = $state(false);
	let totalSize = $state('0 Bytes');

	// Add effect to recalculate total size when files change
	$effect(() => {
		const total = files.reduce((sum, file) => sum + file.size, 0);
		totalSize = formatFileSize(total);
	});

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		if (!isDragging) isDragging = true;
	};

	const handleDragLeave = () => {
		isDragging = false;
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			files = [...files, ...Array.from(e.dataTransfer.files)];
			isUploading = true;
		}
	};

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			files = [...files, ...Array.from(target.files)];
			isUploading = true;
		}
		// Reset input to allow selecting same file again
		target.value = '';
	};

	const removeFile = (file: File) => {
		files = files.filter((f) => f !== file);
		if (files.length === 0) {
			isUploading = false;
		}
	};

	// Helper function to format file sizes
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};
</script>

<!-- Main Content -->
<main class="flex flex-1 items-center justify-center p-4">
	<Card class="mx-auto w-full max-w-6xl border-border bg-card">
		<CardContent class="p-6">
			{#if isUploading}
				<!-- Upload Interface -->
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Left Column: File List and Controls -->
					<div class="flex flex-col">
						<!-- File List -->
						<div class="mb-4 rounded-lg border border-border bg-card p-4">
							{#each files as file}
								<div
									class="flex items-center justify-between border-b border-border pb-2 last:border-b-0"
								>
									<div class="flex items-center">
										<div class="mr-2 rounded bg-primary/10 p-1">
											<FileIcon class="h-4 w-4 text-primary" />
										</div>
										<div>
											<div class="font-medium">{file.name}</div>
											<div class="text-sm text-muted-foreground">{formatFileSize(file.size)}</div>
										</div>
									</div>
									<button
										onclick={() => removeFile(file)}
										class="text-muted-foreground hover:text-foreground"
									>
										<X class="h-4 w-4" />
									</button>
								</div>
							{/each}
						</div>

						<!-- Controls -->
						<div class="mb-4 flex items-center">
							<button
								class="flex items-center text-sm text-primary hover:underline"
								onclick={() => document.getElementById('file-input')?.click()}
							>
								<Plus class="mr-1 h-4 w-4" />
								Select files to upload
							</button>
							<input
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
								<select class="ml-2 rounded border border-border bg-background px-2 py-1 text-sm">
									<option>1 download</option>
									<option>5 downloads</option>
									<option>10 downloads</option>
								</select>
								<span class="mx-2 text-sm">or</span>
								<select class="rounded border border-border bg-background px-2 py-1 text-sm">
									<option>1 day</option>
									<option>7 days</option>
									<option>30 days</option>
								</select>
							</div>
							<div class="flex items-center">
								<input type="checkbox" id="password" class="mr-2" />
								<label for="password" class="text-sm">Protect with password</label>
							</div>
						</div>

						<Button class="w-full">Upload</Button>
					</div>

					<!-- Right Column: Info -->
					<div class="flex flex-col justify-center p-4 lg:p-8">
						<h2 class="mb-4 text-2xl font-bold md:mb-2 md:text-xl lg:mb-6 lg:text-3xl">
							Simple, private file sharing
						</h2>
						<p
							class="mb-6 text-muted-foreground md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed"
						>
							Send lets you share files with end-to-end encryption and a link that automatically
							expires. So you can keep what you share private and make sure your stuff doesn't stay
							online forever.
						</p>
						<div class="rounded-xl border border-border bg-muted/50 p-4 md:p-3 lg:p-5">
							<div class="flex items-center">
								<Bird class="mr-3 h-6 w-6 text-primary md:h-5 md:w-5" />
								<span class="text-base font-medium md:text-sm">Sponsored by Thunderbird</span>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Initial Drop Area -->
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<!-- Left Column: Drop Area -->
					<div
						class="group relative flex h-[480px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card p-12 transition-colors duration-200 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:outline-none"
						ondragover={handleDragOver}
						ondragenter={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						tabindex="0"
						role="button"
						aria-label="File drop area - click or drop files to upload"
					>
						<!-- Flowing border animation container -->
						<div
							class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl transition-opacity duration-200"
							class:opacity-100={isDragging}
							class:opacity-0={!isDragging}
						>
							<!-- Top border flow -->
							<div
								class="animate-flow-x absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
							></div>
							<!-- Right border flow -->
							<div
								class="animate-flow-y absolute top-0 right-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-primary to-transparent"
							></div>
							<!-- Bottom border flow -->
							<div
								class="animate-flow-x-reverse absolute right-0 bottom-0 left-0 h-0.5 bg-gradient-to-l from-transparent via-primary to-transparent"
							></div>
							<!-- Left border flow -->
							<div
								class="animate-flow-y-reverse absolute top-0 bottom-0 left-0 w-0.5 bg-gradient-to-t from-transparent via-primary to-transparent"
							></div>
						</div>

						<!-- Content with reduced opacity during drag -->
						<div
							class="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary transition-opacity duration-200"
							class:opacity-40={isDragging}
							class:opacity-100={!isDragging}
						>
							<Plus
								class="h-8 w-8 text-primary transition-opacity duration-200 {isDragging
									? 'opacity-40'
									: 'opacity-100'}"
							/>
						</div>
						<h2
							class="relative z-10 mb-2 text-xl font-medium transition-opacity duration-200"
							class:opacity-40={isDragging}
							class:opacity-100={!isDragging}
						>
							Drag and drop files
						</h2>
						<p
							class="relative z-10 mb-8 text-center text-muted-foreground transition-opacity duration-200 md:mb-4 md:text-sm"
							class:opacity-40={isDragging}
							class:opacity-100={!isDragging}
						>
							or click to send up to 2.5GB of files with end-to-end encryption
						</p>
						<Button
							variant="default"
							size="lg"
							class="relative z-10 px-8 py-6 text-lg transition-opacity duration-200 md:px-6 md:py-4 md:text-base {isDragging
								? 'opacity-40'
								: 'opacity-100'}"
							onclick={() => document.getElementById('file-input-initial')?.click()}
						>
							Select files to upload
							<input
								type="file"
								id="file-input-initial"
								class="hidden"
								multiple
								onchange={handleFileSelect}
							/>
						</Button>
					</div>

					<!-- Right Column: Info -->
					<div class="flex flex-col justify-between p-2 lg:p-8">
						<div>
							<h2 class="mb-4 text-2xl font-bold md:mb-2 md:text-xl lg:mb-6 lg:text-3xl">
								Simple, private file sharing
							</h2>
							<p
								class="mb-6 text-muted-foreground md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed"
							>
								Send lets you share files with end-to-end encryption and a link that automatically
								expires. So you can keep what you share private and make sure your stuff doesn't
								stay online forever.
							</p>
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</main>

<style>
	/* Flowing border animations */
	@keyframes flow-x {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	@keyframes flow-y {
		0% {
			transform: translateY(-100%);
		}
		100% {
			transform: translateY(100%);
		}
	}

	@keyframes flow-x-reverse {
		0% {
			transform: translateX(100%);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	@keyframes flow-y-reverse {
		0% {
			transform: translateY(100%);
		}
		100% {
			transform: translateY(-100%);
		}
	}

	.animate-flow-x {
		animation: flow-x 2s linear infinite;
	}

	.animate-flow-y {
		animation: flow-y 2s linear infinite;
	}

	.animate-flow-x-reverse {
		animation: flow-x-reverse 2s linear infinite;
	}

	.animate-flow-y-reverse {
		animation: flow-y-reverse 2s linear infinite;
	}
</style>
