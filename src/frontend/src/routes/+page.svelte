<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Send, Bird, Plus } from 'lucide-svelte';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';

	// Svelte 5 runes state
	let isDragging = $state(false);

	// TypeScript-typed event handlers
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
		// Handle file drop logic would go here
	};
</script>

<div class="flex min-h-screen min-w-screen flex-col bg-background text-foreground">
	<!-- Top Bar - Split layout on all viewports -->
	<header class="flex items-center justify-between border-b border-border p-4">
		<div class="flex items-center">
			<Send class="h-6 w-6 text-primary" />
			<h1 class="ml-2 text-2xl font-bold md:text-xl">Send</h1>
		</div>

		<Button variant="outline" size="icon">
			<SunIcon
				class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
			/>
			<MoonIcon
				class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
			/>
			<span class="sr-only">Toggle theme</span>
		</Button>
	</header>

	<!-- Main Content - Responsive layout -->
	<main class="flex flex-1 items-center justify-center p-4">
		<Card class="mx-auto w-full max-w-6xl border-border bg-card">
			<CardContent class="p-6">
				<!-- Responsive grid: single column on mobile, two columns on large screens -->
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
						>
							Select files to upload
							<input type="file" class="hidden" multiple />
						</Button>
					</div>

					<!-- Right Column: Info - responsive padding -->
					<div class="flex flex-col justify-center p-4 lg:p-8">
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

							<div class="rounded-xl border border-border bg-muted/50 p-4 md:p-3 lg:p-5">
								<div class="flex items-center">
									<Bird class="mr-3 h-6 w-6 text-primary md:h-5 md:w-5" />
									<span class="text-base font-medium md:text-sm">Sponsored by Thunderbird</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	</main>

	<!-- Footer - responsive layout -->
	<footer class="border-t border-border p-4">
		<div
			class="mx-auto flex max-w-6xl flex-col items-end space-y-2 text-sm text-muted-foreground md:flex-row md:justify-end md:space-y-0 md:space-x-6"
		>
			<a href="#" class="font-medium transition-colors hover:text-foreground">Donate</a>
			<a href="#" class="font-medium transition-colors hover:text-foreground">CLI</a>
			<a href="#" class="font-medium transition-colors hover:text-foreground">DMCA</a>
			<a href="#" class="font-medium transition-colors hover:text-foreground">Source</a>
		</div>
	</footer>
</div>

<style>
	/* Flowing border animations compatible with Svelte 5 and TypeScript */
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
