import { Api } from '#consts/backend';
import { createDecryptedStream } from '#functions/streams';
import { ZipReader } from '@zip.js/zip.js';

export class PasswordRequiredError extends Error {
	constructor() {
		super('Password required for decryption');
		this.name = 'PasswordRequiredError';
	}
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
					onProgress(Math.round((loaded / totalSize) * 100));
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
			if (done) {
				controller.close();
				return;
			}
			controller.enqueue(value);
		},
		cancel(reason) {
			return decReader.cancel(reason);
		}
	});

	let finalStream = verifiedStream;
	let finalDownloadName = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;

	const zipReader = new ZipReader(verifiedStream);
	let entries;
	try {
		entries = await zipReader.getEntries();
	} catch (err) {
		await zipReader.close();
		throw err;
	}

	const firstEntry = entries.find((e) => !e.directory);
	if (!firstEntry) {
		await zipReader.close();
		throw new Error('No files found in the archive');
	}

	finalDownloadName = firstEntry.filename.split(/[/\\]/).pop() || firstEntry.filename;
	const { readable, writable } = new TransformStream();
	// Start extracting in the background
	firstEntry
		.getData(writable, { password: password?.length ? password : undefined })
		.then(() => zipReader.close())
		.catch((err) => {
			console.error('Failed to extract:', err);
			writable.abort(err);
			zipReader.close().catch(() => undefined);
		});
	finalStream = readable;

	const chunks: Uint8Array[] = [];
	const finalReader = finalStream.getReader();
	while (true) {
		const { done, value } = await finalReader.read();
		if (done) break;
		chunks.push(value);
	}
	const blob = new Blob(chunks as any);

	if ((window as any).showSaveFilePicker) {
		const handle = await (window as any).showSaveFilePicker({
			suggestedName: finalDownloadName
		});
		const writable = await handle.createWritable();
		await blob.stream().pipeTo(writable);
	} else {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = finalDownloadName;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}
}
