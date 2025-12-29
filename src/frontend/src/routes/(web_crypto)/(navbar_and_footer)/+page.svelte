<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { useConfigQuery } from '$lib/queries/config';
	import { Bird, Plus, X, FileIcon } from 'lucide-svelte';
	import { marked } from '$lib/functions/marked';
	import { formatFileSize } from '$lib/functions/bytes';

	const { config: configData } = useConfigQuery();

	let isDragging = $state(false);
	let files: File[] = $state([]);
	let isUploading = $state(false);
	let totalSize = $state('0 Bytes');
	let fileInputInitial = $state<HTMLInputElement>();
	let fileInput = $state<HTMLInputElement>();

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
</script>

<!-- Main Content -->
<main class="flex flex-1 items-center justify-center p-4">
	<Card
		class="mx-auto w-full max-w-6xl border-border bg-card shadow-[0_0_15px_-12px_var(--primary)] transition-all duration-200 {isDragging
			? 'shadow-[0_0_40px_-10px_var(--primary)]'
			: ''}"
	>
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
						class="relative flex h-full cursor-pointer flex-col items-center justify-center rounded-lg bg-card transition-all duration-200 focus:outline-none"
						ondragover={handleDragOver}
						ondragenter={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
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
								or click to send up to 2.5GB of files with end-to-end encryption
							</p>

							<!-- Button -->
							<Button
								variant="default"
								size="lg"
								class="px-8 py-6 text-lg transition-opacity duration-200 md:px-6 md:py-4 md:text-base {isDragging
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
									? 'dash-animation text-primary'
									: ''}"
								stroke-dasharray="10"
							/>
						</svg>
					</div>

					<!-- Right Column: Info -->
					<div class="flex flex-col justify-between p-2 lg:p-8">
						<div
							class="mb-6 text-muted-foreground md:mb-4 md:text-sm lg:mb-8 lg:text-lg lg:leading-relaxed"
						>
							{@html marked.parse(configData.data?.site_description ?? '')}
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</main>

<style>
	/* Alternative border animation using SVG */
	.dash-animation {
		stroke-dasharray: 10;
		animation: dash 1s linear infinite;
	}

	@keyframes dash {
		to {
			stroke-dashoffset: 20;
		}
	}
</style>
