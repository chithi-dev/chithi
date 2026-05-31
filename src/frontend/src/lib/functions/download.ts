import { Api } from '#consts/backend';
import { createDecryptedStream } from '#functions/streams';
import { PasswordRequiredError } from '$lib/errors/password';
import { ZipReader } from '@zip.js/zip.js';

const hasSavePicker = 'showSaveFilePicker' in window;

export function saveBlobUrl(blobOrUrl: Blob | string, filename: string) {
	const url = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	URL.revokeObjectURL(url);
	document.body.removeChild(a);
}

async function triggerDownload(blob: Blob, filename: string) {
	if (hasSavePicker) {
		const handle = await (window as any).showSaveFilePicker({ suggestedName: filename });
		const writable = await (handle as FileSystemFileHandle).createWritable();
		await blob.stream().pipeTo(writable);
		return;
	}
	saveBlobUrl(blob, filename);
}

export async function downloadAndDecryptFile(
	slug: string,
	key: string,
	password: string,
	filename: string,
	fileSize: number,
	onProgress: (percent: number) => void
) {
	const res = await fetch(Api.DOWNLOAD(slug));
	if (!res.ok) throw new Error('Download failed');
	if (!res.body) throw new Error('No response body');

	const reader = res.body.getReader();
	let loaded = 0;

	const streamWithProgress = new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) return controller.close();
			loaded += value.byteLength;
			if (fileSize > 0) onProgress(Math.round((loaded / fileSize) * 100));
			controller.enqueue(value);
		},
		cancel: (reason) => reader.cancel(reason)
	});

	const { stream: decryptedStream } = await createDecryptedStream(
		streamWithProgress,
		key,
		password
	);

	// Collect all decrypted chunks into a blob
	const chunks: Uint8Array[] = [];
	try {
		for await (const chunk of decryptedStream) {
			chunks.push(chunk);
		}
	} catch (e: any) {
		if (e.name === 'OperationError') throw new PasswordRequiredError();
		throw e;
	}

	const blob = new Blob(chunks as BlobPart[]);
	const zipReader = new ZipReader(blob.stream());

	let entries;
	try {
		entries = await zipReader.getEntries();
	} catch {
		await zipReader.close();
		throw new Error('Failed to read archive');
	}

	const firstEntry = entries.find((e) => !e.directory);
	if (!firstEntry) {
		await zipReader.close();
		throw new Error('No files found in the archive');
	}

	const downloadName = firstEntry.filename.split(/[/\\]/).pop() ?? filename;
	const { readable, writable } = new TransformStream();

	firstEntry
		.getData(writable, { password: password?.length ? password : undefined })
		.then(() => zipReader.close())
		.catch((err) => {
			console.error('Failed to extract:', err);
			writable.abort(err);
			zipReader.close().catch(() => undefined);
		});

	const fileChunks: Uint8Array[] = [];
	const finalReader = readable.getReader();
	while (true) {
		const { done, value } = await finalReader.read();
		if (done) break;
		fileChunks.push(value);
	}

	await triggerDownload(new Blob(fileChunks as BlobPart[]), downloadName);
}
