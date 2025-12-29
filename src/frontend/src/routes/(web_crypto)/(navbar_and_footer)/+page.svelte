<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { useConfigQuery } from '$lib/queries/config';
	import { Bird, Plus, X, FileIcon, Eye, EyeOff } from 'lucide-svelte';
	import { marked } from '$lib/functions/marked';
	import { formatFileSize } from '$lib/functions/bytes';

	const { config: configData } = useConfigQuery();

	let isDragging = $state(false);
	let files: File[] = $state([]);
	let isUploading = $state(false);
	let totalSize = $state('0 Bytes');
	let fileInputInitial = $state<HTMLInputElement>();
	let fileInput = $state<HTMLInputElement>();
	let downloadLimit = $state('1 download');
	let timeLimit = $state('1 day');
	let isPasswordProtected = $state(false);
	let password = $state('');
	let showPassword = $state(false);

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
			class="animate-blob absolute -top-[20%] -left-[20%] h-160 w-160 rounded-full bg-purple-300/40 mix-blend-multiply blur-[100px] filter dark:bg-purple-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="animate-blob animation-delay-2000 absolute top-[10%] -right-[20%] h-140 w-140 rounded-full bg-yellow-300/40 mix-blend-multiply blur-[100px] filter dark:bg-indigo-900/40 dark:mix-blend-hard-light"
		></div>
		<div
			class="animate-blob animation-delay-4000 absolute -bottom-[20%] left-[20%] h-180 w-180 rounded-full bg-pink-300/40 mix-blend-multiply blur-[100px] filter dark:bg-blue-900/40 dark:mix-blend-hard-light"
		></div>

		<!-- Grid with Pulse -->
		<div
			class="animate-pulse-slow absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"
		></div>

		<!-- Floating Particles & Stars -->
		<div class="absolute inset-0 overflow-hidden">
			<div
				class="animate-float absolute top-[20%] left-[10%] h-2 w-2 rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="animate-float animation-delay-2000 absolute top-[60%] right-[15%] h-3 w-3 rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="animate-float animation-delay-4000 absolute bottom-[10%] left-[30%] h-2 w-2 rounded-full bg-primary/20 blur-[1px]"
			></div>
			<div
				class="animate-float animation-delay-5000 absolute top-[30%] right-[40%] h-1.5 w-1.5 rounded-full bg-primary/30 blur-[1px]"
			></div>

			<!-- Twinkling Stars -->
			<div
				class="animate-twinkle absolute top-[15%] left-[25%] h-1 w-1 rounded-full bg-yellow-200/60 blur-[0.5px]"
			></div>
			<div
				class="animate-twinkle animation-delay-2000 absolute top-[35%] right-[25%] h-1.5 w-1.5 rounded-full bg-blue-200/60 blur-[0.5px]"
			></div>
			<div
				class="animate-twinkle animation-delay-4000 absolute bottom-[25%] left-[45%] h-1 w-1 rounded-full bg-purple-200/60 blur-[0.5px]"
			></div>
			<div
				class="animate-twinkle animation-delay-5000 absolute top-[10%] right-[10%] h-0.5 w-0.5 rounded-full bg-white/60 blur-[0.5px]"
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
								<Select.Root type="single" bind:value={downloadLimit}>
									<Select.Trigger class="ml-2 w-35">
										{downloadLimit}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="1 download">1 download</Select.Item>
										<Select.Item value="5 downloads">5 downloads</Select.Item>
										<Select.Item value="10 downloads">10 downloads</Select.Item>
									</Select.Content>
								</Select.Root>
								<span class="mx-2 text-sm">or</span>
								<Select.Root type="single" bind:value={timeLimit}>
									<Select.Trigger class="w-35">
										{timeLimit}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="1 day">1 day</Select.Item>
										<Select.Item value="7 days">7 days</Select.Item>
										<Select.Item value="30 days">30 days</Select.Item>
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
											class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

						<Button class="w-full">Upload</Button>
					</div>

					<!-- Right Column: Info -->
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

	@keyframes blob {
		0% {
			transform: translate(0px, 0px) scale(1);
		}
		33% {
			transform: translate(30px, -50px) scale(1.1);
		}
		66% {
			transform: translate(-20px, 20px) scale(0.9);
		}
		100% {
			transform: translate(0px, 0px) scale(1);
		}
	}
	.animate-blob {
		animation: blob 7s infinite;
	}
	.animation-delay-2000 {
		animation-delay: 2s;
	}
	.animation-delay-4000 {
		animation-delay: 4s;
	}
	.animation-delay-5000 {
		animation-delay: 5s;
	}

	@keyframes pulse-slow {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}
	@keyframes float {
		0% {
			transform: translateY(0px) translateX(0px);
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translateY(-100px) translateX(20px);
			opacity: 0;
		}
	}
	.animate-pulse-slow {
		animation: pulse-slow 8s ease-in-out infinite;
	}
	.animate-float {
		animation: float 10s linear infinite;
	}
	.animate-twinkle {
		animation: twinkle 4s ease-in-out infinite;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.2;
			transform: scale(0.8);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
	}
</style>
