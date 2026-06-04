<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { CircleAlert, LoaderCircle, KeyRound } from '@lucide/svelte';
	import { page } from '$app/state';
	import { fetchDecryptedBlob } from '$lib/functions/fetch-decrypt';
	import { PasswordRequiredError } from '#errors/password';
	import { BlobWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
	import { detectMimeFromBlob } from '#functions/mime';
	import { createViewableText } from '$lib/functions/viewer';
	import FileViewerOverlay from '$lib/components/FileViewerOverlay.svelte';
	import { autoDownload } from '$lib/functions/browser-download';
	import { validateZipBlob } from '#functions/zip-validate';

	const key = $derived(page.url.hash ? page.url.hash.slice(1).trim() : null);
	const slug = $derived(page.params.slug);

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
			const blob = await fetchDecryptedBlob(slug, key, password, {});

			await validateZipBlob(blob);

			const fullData = new Uint8Array(await blob.arrayBuffer());
			const zipReader = new ZipReader(new Uint8ArrayReader(fullData));

			try {
				const entries = await zipReader.getEntries();
				const fileEntries = entries.filter((e) => !e.directory);

				if (fileEntries.length === 0) throw new Error('Archive is empty');

				if (fileEntries.length > 1) {
					throw new Error(
						'View Once only supports a single file. Use the upload page with one file.'
					);
				}

				const entry = fileEntries[0];
				if (!entry.getData) throw new Error('Cannot read file from archive');

				entryFilename = entry.filename.split('/').pop() || 'file';
				const rawBlob = await entry.getData(new BlobWriter('application/octet-stream'));
				const detectedMime = await detectMimeFromBlob(rawBlob);
				const viewBlob = detectedMime
					? rawBlob.slice(0, rawBlob.size, detectedMime)
					: rawBlob;
				const text = await createViewableText(viewBlob, detectedMime);

				contentText = text ?? null;
				contentUrl = text === null ? URL.createObjectURL(viewBlob) : null;
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
				errorMsg = e.message?.includes('missing end marker')
					? 'The archive appears truncated or corrupted on the server.'
					: (e.message || 'Something went wrong');
			}
		}
	}

	function handleDownloadFile() {
		const url = contentUrl;
		if (!url && contentText === null) return;
		const blobUrl = url || URL.createObjectURL(new Blob([contentText!], { type: 'text/plain' }));
		autoDownload(blobUrl, entryFilename);
		if (!url) URL.revokeObjectURL(blobUrl);
	}

	$effect(() => {
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
					onkeydown={(e) => e.key === 'Enter' && fetchDecryptAndShow()}
				/>
				<Button class="rounded-l-none" onclick={fetchDecryptAndShow}>Unlock</Button>
			</div>
		</div>
	</div>
{:else if status === 'error'}
	<div class="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-destructive">
		<CircleAlert class="h-10 w-10" />
		<p class="font-medium">{errorMsg}</p>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center">
		<LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{/if}
