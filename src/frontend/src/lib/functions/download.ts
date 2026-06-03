import { autoDownload } from '#functions/browser-download';
import { fetchDecryptedBlob } from '#functions/fetch-decrypt';
import { ZipReader } from '@zip.js/zip.js';

/**
 * Download an encrypted file, decrypt it, extract from ZIP if needed,
 * and trigger a browser download via File System Access API or fallback.
 */
export async function downloadAndDecryptFile(
	slug: string,
	key: string,
	password: string,
	filename: string,
	fileSize: number,
	onProgress: (percent: number) => void
) {
	const blob = await fetchDecryptedBlob(slug, key, password, {
		knownSize: fileSize,
		onProgress
	});

	let finalStream: ReadableStream = blob.stream();
	let finalDownloadName = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;

	const zipReader = new ZipReader(finalStream as ReadableStream<Uint8Array>);
	try {
		const entries = await zipReader.getEntries();
		const firstEntry = entries.find((e) => !e.directory);
		if (!firstEntry) {
			await zipReader.close();
			throw new Error('No files found in the archive');
		}

		finalDownloadName = firstEntry.filename.split(/[/\\]/).pop() || firstEntry.filename;
		const { readable, writable } = new TransformStream();
		firstEntry
			.getData(writable, { password })
			.then(() => zipReader.close())
			.catch((err) => {
				console.error('Failed to extract:', err);
				writable.abort(err);
				zipReader.close().catch(() => undefined);
			});
		finalStream = readable;
	} catch (err) {
		await zipReader.close();
		throw err;
	}

	const chunks: Uint8Array[] = [];
	const reader = finalStream.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const extractedBlob = new Blob(chunks as BlobPart[]);

	if ((window as any).showSaveFilePicker) {
		const handle = await (window as any).showSaveFilePicker({
			suggestedName: finalDownloadName
		});
		const writable = await handle.createWritable();
		await extractedBlob.stream().pipeTo(writable);
	} else {
		const url = URL.createObjectURL(extractedBlob);
		autoDownload(url, finalDownloadName);
		URL.revokeObjectURL(url);
	}
}
