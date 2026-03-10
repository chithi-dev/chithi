<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import {
		FileText,
		CircleAlert,
		LoaderCircle,
		Download,
		KeyRound,
		Eye,
		File,
		Folder,
		ExternalLink,
		Image as ImageIcon,
		FileCode,
		FolderOpen,
		FilePlay,
		FileHeadphone
	} from 'lucide-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import { BACKEND_API } from '#consts/backend';
	import { PasswordRequiredError } from '#functions/download';
	import { createDecryptedStream } from '#functions/streams';
	import { formatFileSize } from '#functions/bytes';
	import { toast } from 'svelte-sonner';
	import { Progress } from '$lib/components/ui/progress';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { ZipReader, BlobReader, BlobWriter, type Entry } from '@zip.js/zip.js';
	import { getMimeType } from '#functions/mime';
	import { createViewableText } from '$lib/functions/viewer';
	import FileViewerOverlay from '$lib/components/FileViewerOverlay.svelte';

	let key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
	let slug = $derived(page.params.slug);
	let fileParam = $derived(page.url.searchParams.get('file'));

	let status = $state<
		'checking' | 'ready' | 'needs_password' | 'error' | 'downloading' | 'unzipping' | 'listing'
	>('checking');

	let errorMsg = $state('');
	let filename = $state('file');
	let fileSize = $state(0);
	let password = $state('');
	let downloadProgress = $state(new Tween(0, { duration: 500, easing: cubicOut }));

	let zipEntries = $state<Entry[]>([]);
	let decryptedBlob = $state<Blob | null>(null);

	// Viewer state
	let viewingFile = $state<{ text: string | null; url: string | null; filename: string } | null>(
		null
	);

	function getFileIcon(name: string) {
		const n = name.toLowerCase();
		if (n.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|avif)$/)) return ImageIcon;
		if (n.match(/\.(mp4|webm|ogv|mov|mkv)$/)) return FilePlay;
		if (n.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) return FileHeadphone;
		if (
			n.match(
				/\.(txt|md|json|js|ts|svelte|html|css|scss|xml|log|csv|sh|yaml|yml|sql|py|java|c|cpp|h|go|rs|php|rb)$/
			)
		)
			return FileCode;
		return File;
	}

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
		await fetchAndUnzip();
	}

	async function fetchAndUnzip() {
		if (!key || !slug) return;
		const previousStatus = status;
		status = 'downloading';
		downloadProgress = new Tween(0, { duration: 500, easing: cubicOut });

		try {
			const blob = await downloadFileBlob(
				slug,
				key,
				password,
				fileSize,
				(p) => (downloadProgress.target = p)
			);
			decryptedBlob = blob;

			status = 'unzipping';
			const reader = new ZipReader(new BlobReader(blob));
			zipEntries = await reader.getEntries();
			status = 'listing';
			toast.success('Files extracted successfully');

			// Auto-open file from URL param if it exactly matches an entry
			if (fileParam) {
				const match = zipEntries.find((e) => e.filename === fileParam);
				if (match) openEntry(match);
			}
		} catch (e: any) {
			console.error(e);
			if (e instanceof PasswordRequiredError) {
				status = 'needs_password';
				toast.info('Password required for decryption');
			} else if (previousStatus === 'needs_password' && password) {
				toast.error('Incorrect password?');
				status = 'needs_password';
			} else if (e.name === 'AbortError') {
				status = 'ready';
			} else {
				toast.error('Failed: ' + e.message);
				status = 'error';
				errorMsg = 'Processing failed: ' + e.message;
			}
		}
	}

	async function downloadFileBlob(
		slug: string,
		key: string,
		password: string,
		totalSize: number,
		onProgress: (percent: number) => void
	): Promise<Blob> {
		const res = await fetch(`${BACKEND_API}/download/${slug}`);
		if (!res.ok) throw new Error('Download failed');
		if (!res.body) throw new Error('No response body');

		let loaded = 0;
		const reader = res.body.getReader();
		const streamWithProgress = new ReadableStream({
			async pull(controller) {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}
				loaded += value.byteLength;
				if (totalSize > 0) onProgress(Math.round((loaded / totalSize) * 100));
				controller.enqueue(value);
			},
			cancel(reason) {
				return reader.cancel(reason);
			}
		});

		const { stream: decryptedStream } = await createDecryptedStream(
			streamWithProgress,
			key,
			password
		);
		const decReader = decryptedStream.getReader();
		let firstChunk: Uint8Array | undefined;

		try {
			const { done, value } = await decReader.read();
			if (!done) firstChunk = value;
		} catch (e: any) {
			if (e.name === 'OperationError') {
				await reader.cancel('Wrong password');
				throw new PasswordRequiredError();
			}
			throw e;
		}

		const chunks: Uint8Array[] = [];
		if (firstChunk) chunks.push(firstChunk);
		while (true) {
			const { done, value } = await decReader.read();
			if (done) break;
			chunks.push(value);
		}

		return new Blob(chunks as BlobPart[], { type: 'application/zip' });
	}

	function setFileParam(name: string | null) {
		const url = new URL(page.url);
		if (name) {
			url.searchParams.set('file', name);
		} else {
			url.searchParams.delete('file');
		}
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function openEntry(entry: Entry) {
		if (entry.directory || !entry.getData) return;
		const mime = getMimeType(entry.filename);
		const rawBlob = await entry.getData(new BlobWriter(mime));

		const text = await createViewableText(rawBlob, entry.filename);
		if (text !== null) {
			viewingFile = { text, url: null, filename: entry.filename };
			setFileParam(entry.filename);
			return;
		}

		const url = URL.createObjectURL(rawBlob);
		viewingFile = { text: null, url, filename: entry.filename };
		setFileParam(entry.filename);
	}

	function closeViewer() {
		if (viewingFile?.url) URL.revokeObjectURL(viewingFile.url);
		viewingFile = null;
		setFileParam(null);
	}

	function copyViewerLink() {
		if (!viewingFile) return;
		const url = new URL(page.url);
		url.searchParams.set('file', viewingFile.filename);
		navigator.clipboard.writeText(url.toString());
	}

	async function saveEntry(entry: Entry) {
		if (entry.directory || !entry.getData) return;
		const blob = await entry.getData(new BlobWriter());
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = entry.filename.split('/').pop() || 'file';
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}

	function handleDownloadOriginal() {
		if (!decryptedBlob) return;
		const downloadName = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;
		const url = URL.createObjectURL(decryptedBlob);
		const a = document.createElement('a');
		a.href = url;
		a.download = downloadName;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}
</script>

<Card.Root class="relative z-10 mx-auto w-full max-w-5xl border-border bg-card">
	<Card.Content class="p-6">
		<div class="flex min-h-150 flex-col items-center justify-center">
			{#if status === 'checking'}
				<div class="flex flex-col items-center justify-center py-8">
					<LoaderCircle class="mb-4 h-8 w-8 animate-spin text-primary" />
					<p class="text-muted-foreground">Verifying key and file...</p>
				</div>
			{/if}

			{#if status === 'error'}
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
							<Button class="w-full" variant="outline" href="/">Go Home</Button>
						</Card.Footer>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-8 text-destructive">
						<CircleAlert class="mb-4 h-12 w-12" />
						<p class="font-medium">{errorMsg}</p>
						<Button variant="outline" class="mt-4" onclick={() => location.reload()}>Retry</Button>
					</div>
				{/if}
			{/if}

			{#if status === 'ready' || status === 'needs_password' || status === 'downloading' || status === 'unzipping'}
				<div class="w-full max-w-lg">
					<Card.Header class="px-0 text-center">
						<Card.Title class="text-2xl font-bold">View Archive</Card.Title>
						<Card.Description class="text-muted-foreground">
							Decrypt and view contents of this archive directly in your browser.
						</Card.Description>
					</Card.Header>

					<Card.Content class="w-full px-0">
						{#if status === 'needs_password'}
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
								<p class="text-xs text-muted-foreground">Enter password to decrypt the archive.</p>
							</div>
						{:else}
							<div class="mb-6 flex items-center gap-4 rounded-lg border bg-background/50 p-4">
								<div class="rounded bg-primary/10 p-2 text-primary">
									{#if status === 'downloading' || status === 'unzipping'}
										<LoaderCircle class="h-6 w-6 animate-spin" />
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
								{#if status === 'downloading' || status === 'unzipping'}
									<div class="w-full space-y-2">
										<Progress value={downloadProgress.current} class="h-2" />
										<div class="flex justify-between text-xs text-muted-foreground">
											<span>{Math.round(downloadProgress.current)}%</span>
											<span class="flex items-center">
												{#if status === 'unzipping'}
													<FolderOpen class="mr-2 h-3 w-3 animate-pulse" />
													Unzipping...
												{:else}
													<Download class="mr-2 h-3 w-3 animate-bounce" />
													Decrypting...
												{/if}
											</span>
										</div>
									</div>
								{:else}
									<Button class="w-full" size="lg" onclick={fetchAndUnzip}>
										<Eye class="mr-2 h-4 w-4" />
										View Contents
									</Button>
								{/if}
							</Card.Footer>
						{/if}
					</Card.Content>
				</div>
			{/if}

			{#if status === 'listing'}
				{#if viewingFile}
					<div class="w-full" in:fade={{ duration: 200 }}>
						<FileViewerOverlay
							filename={viewingFile.filename}
							contentText={viewingFile.text}
							contentUrl={viewingFile.url}
							onclose={closeViewer}
							oncopylink={copyViewerLink}
							ondownload={() => {
								if (!viewingFile) return;
								const blobUrl =
									viewingFile.url ||
									URL.createObjectURL(new Blob([viewingFile.text!], { type: 'text/plain' }));
								const a = document.createElement('a');
								a.href = blobUrl;
								a.download = viewingFile.filename.split('/').pop() || 'file';
								a.style.display = 'none';
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								if (!viewingFile.url) URL.revokeObjectURL(blobUrl);
							}}
						/>
					</div>
				{:else}
					<div class="w-full" in:fade={{ duration: 300 }}>
						<div class="mb-4 flex items-center justify-between">
							<div>
								<h2 class="text-xl font-bold">Contents of {filename}</h2>
								<p class="text-sm text-muted-foreground">{zipEntries.length} items found</p>
							</div>
							<Button variant="outline" onclick={handleDownloadOriginal}>
								<Download class="mr-2 h-4 w-4" />
								Download Original
							</Button>
						</div>

						<div class="rounded-md border">
							<ScrollArea class="h-125">
								<div class="p-2">
									{#each zipEntries as entry}
										<div
											class="group flex w-full items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
										>
											<button
												class="flex flex-1 cursor-pointer items-center gap-3 overflow-hidden border-0 bg-transparent p-0 text-left"
												onclick={() => openEntry(entry)}
											>
												{#if entry.directory}
													<Folder class="h-5 w-5 shrink-0 text-primary" />
												{:else}
													{@const Icon = getFileIcon(entry.filename)}
													<Icon class="h-5 w-5 shrink-0 text-primary" />
												{/if}

												<div class="flex-1 overflow-hidden">
													<p class="truncate text-sm font-medium">{entry.filename}</p>
													{#if !entry.directory}
														<p class="text-xs text-muted-foreground">
															{formatFileSize(entry.uncompressedSize)}
														</p>
													{/if}
												</div>
											</button>

											{#if !entry.directory}
												<div
													class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
												>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														title="View File"
														onclick={() => openEntry(entry)}
													>
														<ExternalLink class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														title="Save File"
														onclick={() => saveEntry(entry)}
													>
														<Download class="h-4 w-4" />
													</Button>
												</div>
											{/if}
										</div>
									{/each}
									{#if zipEntries.length === 0}
										<div class="p-8 text-center text-muted-foreground">
											No files found in this archive.
										</div>
									{/if}
								</div>
							</ScrollArea>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</Card.Content>
</Card.Root>
