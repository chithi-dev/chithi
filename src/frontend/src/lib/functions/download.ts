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
	_numberOfFiles: number,
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

	const decReader = decryptedStream.getReader();
	let firstChunk: Uint8Array | undefined;
	let isDone = false;

	try {
		const { done, value } = await decReader.read();
		isDone = done;
		if (!done) firstChunk = value;
	} catch (e: any) {
		if (e.name === 'OperationError') {
			await reader.cancel('Wrong password');
			throw new PasswordRequiredError();
		}
		throw e;
	}

	const verifiedStream = new ReadableStream({
		async start(controller) {
			if (firstChunk) controller.enqueue(firstChunk);
			if (isDone) controller.close();
		},
		async pull(controller) {
			const { done, value } = await decReader.read();
			if (done) return controller.close();
			controller.enqueue(value);
		},
		cancel: (reason) => decReader.cancel(reason)
	});

	const zipReader = new ZipReader(verifiedStream);
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

	const chunks: Uint8Array[] = [];
	const finalReader = readable.getReader();
	while (true) {
		const { done, value } = await finalReader.read();
		if (done) break;
		chunks.push(value);
	}

	await triggerDownload(new Blob(chunks as BlobPart[]), downloadName);
}
