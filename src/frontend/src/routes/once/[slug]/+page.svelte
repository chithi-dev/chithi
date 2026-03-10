<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { CircleAlert, LoaderCircle, KeyRound } from 'lucide-svelte';
	import { page } from '$app/state';
	import { BACKEND_API } from '#consts/backend';
	import { PasswordRequiredError } from '#functions/download';
	import { createDecryptedStream } from '#functions/streams';
	import { BlobWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
	import { getMimeType } from '#functions/mime';
	import { createViewableText } from '$lib/functions/viewer';
	import FileViewerOverlay from '$lib/components/FileViewerOverlay.svelte';

	let key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
	let slug = $derived(page.params.slug);

	let status = $state<'loading' | 'needs_password' | 'error' | 'viewing'>('loading');
	let errorMsg = $state('');
	let password = $state('');
	let contentUrl = $state<string | null>(null);
	let contentText = $state<string | null>(null);
	let entryFilename = $state('');

	async function fetchDecryptAndShow() {
		if (!key || !slug) {
			status = 'error';
			errorMsg = 'Missing decryption key';
			return;
		}
		status = 'loading';

		try {
			// Fetch encrypted data
			const res = await fetch(`${BACKEND_API}/download/${slug}`);
			if (!res.ok) {
				if (res.status === 404) throw new Error('File not found');
				if (res.status === 410) throw new Error('File expired or already downloaded');
				throw new Error('Download failed');
			}
			if (!res.body) throw new Error('No response body');

			const reader = res.body.getReader();
			const streamForDecrypt = new ReadableStream<Uint8Array>({
				async pull(controller) {
					const { done, value } = await reader.read();
					if (done) {
						controller.close();
						return;
					}
					controller.enqueue(value);
				},
				cancel(reason) {
					return reader.cancel(reason);
				}
			});

			// Decrypt
			const { stream: decryptedStream } = await createDecryptedStream(
				streamForDecrypt,
				key,
				password
			);

			// Read first chunk to detect password errors
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

			// Buffer all decrypted data
			const chunks: Uint8Array[] = [];
			if (firstChunk) chunks.push(firstChunk);
			while (true) {
				const { done, value } = await decReader.read();
				if (done) break;
				chunks.push(value);
			}

			const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
			const fullData = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				fullData.set(chunk, offset);
				offset += chunk.length;
			}

			// Unzip single file
			const zipReader = new ZipReader(new Uint8ArrayReader(fullData));
			try {
				const entries = await zipReader.getEntries();
				const fileEntries = entries.filter((e) => !e.directory);

				if (fileEntries.length === 0) throw new Error('Archive is empty');

				if (fileEntries.length > 1) {
					throw new Error(
						'View Once only supports a single file. Please use the upload page and select "View Once" with one file.'
					);
				}

				const entry = fileEntries[0];
				if (!entry.getData) throw new Error('Cannot read file from archive');

				entryFilename = entry.filename.split('/').pop() || 'file';
				const mime = getMimeType(entryFilename);

				const rawBlob = await entry.getData(new BlobWriter(mime));
				const text = await createViewableText(rawBlob, entryFilename);

				if (text !== null) {
					contentText = text;
				} else {
					contentUrl = URL.createObjectURL(rawBlob);
				}

				status = 'viewing';
			} finally {
				await zipReader.close();
			}
		} catch (e: any) {
			console.error(e);
			if (e instanceof PasswordRequiredError) {
				status = 'needs_password';
			} else {
				status = 'error';
				errorMsg = e.message || 'Something went wrong';
			}
		}
	}

	async function handlePasswordSubmit() {
		if (!key) return;
		await fetchDecryptAndShow();
	}

	function handleDownloadFile() {
		const url = contentUrl;
		if (!url && contentText === null) return;
		const blobUrl = url || URL.createObjectURL(new Blob([contentText!], { type: 'text/plain' }));
		const a = document.createElement('a');
		a.href = blobUrl;
		a.download = entryFilename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		if (!url) URL.revokeObjectURL(blobUrl);
	}

	// Auto-start on mount
	$effect.pre(() => {
		fetchDecryptAndShow();
	});
</script>

{#if status === 'viewing'}
	<FileViewerOverlay
		filename={entryFilename}
		{contentText}
		{contentUrl}
		ondownload={handleDownloadFile}
	/>
{:else if status === 'needs_password'}
	<div class="flex min-h-screen items-center justify-center p-4">
		<div class="w-full max-w-sm space-y-4 text-center">
			<KeyRound class="mx-auto h-10 w-10 text-muted-foreground" />
			<p class="text-lg font-semibold">Password Required</p>
			<div class="flex items-center">
				<Input
					type="password"
					placeholder="Password"
					class="rounded-r-none focus-visible:z-10"
					bind:value={password}
					onkeydown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
				/>
				<Button class="rounded-l-none" onclick={handlePasswordSubmit}>Unlock</Button>
			</div>
		</div>
	</div>
{:else if status === 'error'}
	<div class="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-destructive">
		<CircleAlert class="h-10 w-10" />
		<p class="font-medium">{errorMsg}</p>
	</div>
{:else}
	<!-- Loading: just a centered spinner, no verbose text -->
	<div class="flex min-h-screen items-center justify-center">
		<LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{/if}
