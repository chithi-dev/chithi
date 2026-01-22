<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { FileText, CircleAlert, LoaderCircle, Download } from 'lucide-svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { BACKEND_API } from '$lib/consts/backend';
	import { createDecryptedStream, peekHeader } from '$lib/functions/streams';
	import { formatFileSize } from '$lib/functions/bytes';
	import { toast } from 'svelte-sonner';
	import { Progress } from '$lib/components/ui/progress';

	let key = $derived(page.url.searchParams.get('secret'));
	let slug = $derived(page.params.slug);

	let status = $state<'checking' | 'ready' | 'needs_password' | 'error' | 'downloading'>(
		'checking'
	);
	let errorMsg = $state('');
	let filename = $state('file');
	let fileSize = $state(0);
	let password = $state('');
	let downloadProgress = $state(0);

	async function startCheck() {
		if (!key) {
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

	onMount(() => {
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
		if (!key) return;
		const previousStatus = status;
		status = 'downloading';
		downloadProgress = 0;

		try {
			const res = await fetch(`${BACKEND_API}/download/${slug}`);
			if (!res.ok) throw new Error('Download failed');
			if (!res.body) throw new Error('No response body');

			const totalSize = fileSize;
			let loaded = 0;

			const reader = res.body.getReader();
			const streamWithProgress = new ReadableStream({
				async pull(controller) {
					try {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							return;
						}
						loaded += value.byteLength;
						if (totalSize > 0) {
							downloadProgress = Math.round((loaded / totalSize) * 100);
						}
						controller.enqueue(value);
					} catch (e) {
						controller.error(e);
						throw e;
					}
				},
				cancel(reason) {
					return reader.cancel(reason);
				}
			});

			// Peek the header to see if a password is required without consuming the main download stream
			let downloadStream = streamWithProgress;
			try {
				const [peekStream, passStream] = streamWithProgress.tee();
				const headerInfo = await peekHeader(peekStream);
				if (headerInfo?.needsPassword && !password) {
					// Stop the active reader to avoid wasting bandwidth
					await reader.cancel();
					status = 'needs_password';
					return;
				}
				downloadStream = passStream;
			} catch (e) {
				// If peeking fails, fall back to the full stream and let createDecryptedStream handle errors
				console.warn('Header peek failed, proceeding with full download', e);
			}


			if ('showSaveFilePicker' in window) {
				const handle = await (window as any).showSaveFilePicker({
					suggestedName: `${filename}.zip`
				});
				const writable = await handle.createWritable();

				const { stream: decryptedStream } = await createDecryptedStream(
					downloadStream,
					key,
					password
				);
				await decryptedStream.pipeTo(writable);

				status = 'ready';
				toast.success('Download complete');
			} else {
				const { stream: decryptedStream } = await createDecryptedStream(
					downloadStream,
					key,
					password
				);
				const chunks = [];
				const reader = decryptedStream.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					chunks.push(value);
				}
				const blob = new Blob(chunks as any, { type: 'application/octet-stream' });
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${filename}.zip`;
				a.classList.add('hidden');
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);

				status = 'ready';
				toast.success('Download complete');
			}
		} catch (e: any) {
			console.error(e);
			if (e.message === 'Password required for decryption') {
				status = 'needs_password';
				toast.info('Password required');
				return;
			}

			if (e.name !== 'AbortError') {
				// If we are in needs_password state, and we failed, it might be wrong password
				if (previousStatus === 'needs_password' || password) {
					toast.error('Download failed: Incorrect password or corrupted file');
				} else if (e.name === 'OperationError') {
					toast.error('Download failed: Mismatched key or corrupted file');
					status = 'error';
					errorMsg = 'Mismatched key or corrupted file';
				} else {
					toast.error('Download failed: ' + e.message);
					status = 'error';
					errorMsg = 'Download failed';
				}
			} else {
				status = 'ready';
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
						This file was shared via Send with end-to-end encryption and a link that automatically
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
						<div class="flex flex-col items-center justify-center py-8 text-destructive">
							<CircleAlert class="mb-4 h-12 w-12" />
							<p class="font-medium">{errorMsg}</p>
						</div>
					{:else if status === 'needs_password'}
						<div class="mx-auto flex w-full max-w-sm items-center py-8">
							<Input
								type="password"
								placeholder="Password"
								class="rounded-r-none focus-visible:z-10"
								bind:value={password}
								onkeydown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
							/>
							<Button class="rounded-l-none" onclick={handlePasswordSubmit}>Unlock</Button>
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
