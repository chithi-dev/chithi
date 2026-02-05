<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { FileText, CircleAlert, LoaderCircle, Download, KeyRound } from 'lucide-svelte';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { BACKEND_API } from '$lib/consts/backend';
	import { downloadAndDecryptFile, PasswordRequiredError } from '#functions/download';
	import { formatFileSize } from '#functions/bytes';
	import { toast } from 'svelte-sonner';
	import { Progress } from '$lib/components/ui/progress';
	import CompleteSvg from '$lib/svgs/complete.svelte';

	// Key is provided in the URL fragment (after '#') and must be present there
	let key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
	let slug = $derived(page.params.slug);

	let status = $state<
		'checking' | 'ready' | 'needs_password' | 'error' | 'downloading' | 'completed'
	>('checking');
	let errorMsg = $state('');
	let filename = $state('file');
	let fileSize = $state(0);
	let password = $state('');
	let downloadProgress = $state(0);

	async function startCheck() {
		if (!key || !slug) {
			status = 'error';
			errorMsg = 'Missing decryption key';
			return;
		}
		status = 'checking';
		try {
			const res = await fetch(`${BACKEND_API}/information/${slug}`);
			if (!res.ok) {
				if (res.status === 404) throw new Error('File not found');
				if (res.status === 410) throw new Error('File expired or limit reached');
				throw new Error('Failed to get file info');
			}

			const info = await res.json();
			filename = info.filename;
			fileSize = info.size;
			status = 'ready';
		} catch (e: any) {
			status = 'error';
			errorMsg = e.message || 'An error occurred';
		}
	}

	$effect.pre(() => {
		startCheck();
	});

	async function handlePasswordSubmit() {
		if (!key) return;
		try {
			await handleDownload();
		} catch (e) {
			// Error handled in handleDownload or here?
			// handleDownload sets status.
		}
	}

	async function handleDownload() {
		if (!key || !slug) return;
		const previousStatus = status;
		status = 'downloading';
		downloadProgress = 0;

		try {
			await downloadAndDecryptFile(
				slug,
				key,
				password,
				filename,
				fileSize,
				(p) => (downloadProgress = p)
			);
			status = 'completed';
			toast.success('Download complete');
			if (password) {
				toast.info('Note: The downloaded zip file is also encrypted with your password.');
			}
		} catch (e: any) {
			console.error(e);
			if (e instanceof PasswordRequiredError) {
				status = 'needs_password';
				toast.info('Password required for decryption');
			} else if (previousStatus === 'needs_password' && password) {
				// Retrying with password failed generically? Assume wrong password
				toast.error('Download failed: Incorrect password?');
				status = 'needs_password';
			} else if (e.name === 'AbortError') {
				status = 'ready';
			} else {
				toast.error('Download failed: ' + e.message);
				status = 'error';
				errorMsg = 'Download failed';
			}
		}
	}
</script>


<Card.Root class="relative z-10 mx-auto w-full max-w-5xl border-border bg-card">
	<Card.Content class="p-6">
		<div class="flex min-h-150 flex-col items-center justify-center">
			<div class="w-full max-w-lg">
				<Card.Header class="px-0 text-center">
					<Card.Title class="text-2xl font-bold">Download files</Card.Title>
					<Card.Description class="text-muted-foreground">
						This file was shared via Chithi with end-to-end encryption and a link that automatically
						expires.
					</Card.Description>
				</Card.Header>
				<Card.Content class="w-full px-0">
					{#if status === 'checking'}
						<div class="flex flex-col items-center justify-center py-8">
							<LoaderCircle class="mb-4 h-8 w-8 animate-spin text-primary" />
							<p class="text-muted-foreground">Verifying key and checking file...</p>
						</div>
					{:else if status === 'error'}
						{#if !key}
							<div in:fly={{ y: 20, duration: 800 }} class="mx-auto w-full max-w-lg">
								<Card.Header class="px-0 text-center">
									<div
										class="mx-auto my-3 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10"
									>
										<KeyRound class="h-10 w-10 text-destructive" />
									</div>
									<Card.Title class="text-2xl font-bold">Decryption Key Required</Card.Title>
									<Card.Description class="mt-2 text-muted-foreground">
										{errorMsg || 'The decryption key is missing.'}
									</Card.Description>
								</Card.Header>
								<Card.Footer class="mt-6 flex w-full flex-col gap-6 px-0">
									<Button class="w-full cursor-pointer" variant="outline" href="/">Go Home</Button>
								</Card.Footer>
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center py-8 text-destructive">
								<CircleAlert class="mb-4 h-12 w-12" />
								<p class="font-medium">{errorMsg}</p>
							</div>
						{/if}
					{:else if status === 'needs_password'}
						<div class="mx-auto flex w-full max-w-sm flex-col items-center gap-2 py-8">
							<div class="flex w-full items-center">
								<Input
									type="password"
									placeholder="Password"
									class="rounded-r-none focus-visible:z-10"
									bind:value={password}
									onkeydown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
								/>
								<Button class="rounded-l-none" onclick={handlePasswordSubmit}>Unlock</Button>
							</div>
							<p class="text-xs text-muted-foreground">Enter password to decrypt the download.</p>
						</div>
					{:else if status === 'completed'}
						<div
							in:fly={{ y: 10, duration: 400 }}
							class="flex flex-col items-center justify-center py-4"
						>
							<div class="mb-6 flex flex-col items-center text-muted-foreground">
								<CompleteSvg />
							</div>

							<div class="flex w-full gap-3 pt-2">
								<Button variant="outline" class="flex-1" href="/">Go home</Button>
								<Button class="flex-1" onclick={() => (status = 'ready')}>Download Again</Button>
							</div>
						</div>
					{:else}
						<div class="mb-6 flex items-center gap-4 rounded-lg border bg-background/50 p-4">
							<div class="rounded bg-primary/10 p-2 text-primary">
								{#if status === 'downloading'}
									<Download class="h-6 w-6 " />
								{:else}
									<FileText class="h-6 w-6" />
								{/if}
							</div>
							<div class="flex-1 overflow-hidden">
								<p class="truncate font-medium">{filename}</p>
								<p class="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
							</div>
						</div>

						<Card.Footer class="flex w-full flex-col gap-6 px-0">
							{#if status === 'downloading'}
								<div class="w-full space-y-2">
									<Progress value={downloadProgress} class="h-2" />
									<div class="flex justify-between text-xs text-muted-foreground">
										<span>{downloadProgress}%</span>
										<span class="flex items-center">
											<Download class="mr-2 h-3 w-3 animate-bounce" />
											Decrypting & Downloading...
										</span>
									</div>
								</div>
							{:else}
								<Button class="w-full cursor-pointer" size="lg" onclick={handleDownload}>
									<Download class="mr-2 h-4 w-4" />
									Download
								</Button>
							{/if}
						</Card.Footer>
					{/if}
				</Card.Content>
			</div>
		</div>
	</Card.Content>
</Card.Root>
