import { CHUNK_SIZE as STREAM_CHUNK_SIZE, WORKER_CONCURRENCY } from '#consts/concurrency';
import { HKDF_IV_STR } from '#consts/encryption';
import EncryptionWorker from '#workers/encryption.worker?worker';
import { ZipWriter } from '@zip.js/zip.js';
import {
	argon2Derive,
	base64url,
	base64urlToBytes,
	deriveAESKeyFromIKM,
	xorBytes
} from './encryption';

const usedNames = new Map<string, number>();
const makeUnique = (name: string) => {
	if (!usedNames.has(name)) {
		usedNames.set(name, 1);
		return name;
	}
	const count = usedNames.get(name) ?? 1;
	usedNames.set(name, count + 1);

	const lastDot = name.lastIndexOf('.');
	if (lastDot > 0) {
		const base = name.slice(0, lastDot);
		const ext = name.slice(lastDot);
		return `${base}_${count}${ext}`;
	}
	return `${name}_${count}`;
};

async function deriveSecrets(ikm: Uint8Array, password?: string) {
	const enc = new TextEncoder();
	const derivedSalt = await crypto.subtle.digest(
		'SHA-256',
		new Uint8Array([...ikm, ...enc.encode(HKDF_IV_STR)])
	);
	let finalIKM = ikm;

	if (password && password.length > 0) {
		const saltBytes = new Uint8Array(derivedSalt).slice(0, 16);
		const passwordBytes = new TextEncoder().encode(password);
		const pb = await argon2Derive(passwordBytes, saltBytes, 32, 16384, 32, 1);
		finalIKM = xorBytes(ikm, pb);
	}

	const hkdfSalt = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode('aes-key')]))
	).slice(0, 16);

	const baseIv = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode(HKDF_IV_STR)]))
	).slice(0, 12);

	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	return { aesKey, baseIv, finalIKM };
}

async function splitInputRanges(
	inputStream: ReadableStream<Uint8Array>,
	chunkSize: number,
	concurrency: number
) {
	const ranges: { range: ReadableStream<Uint8Array>; startChunkIndex: number }[] = [];

	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	for await (const chunk of inputStream) {
		chunks.push(chunk);
		totalBytes += chunk.byteLength;
	}
	const fullBuffer = new Uint8Array(totalBytes);
	let offset = 0;
	for (const c of chunks) {
		fullBuffer.set(c, offset);
		offset += c.byteLength;
	}

	if (concurrency < 1 || totalBytes === 0) return ranges;

	const bytesPerWorker = Math.ceil(totalBytes / concurrency);
	let globalChunkIndex = 0;

	for (let i = 0; i < concurrency && globalChunkIndex * chunkSize < fullBuffer.byteLength; i++) {
		const startByte = i * bytesPerWorker;
		const endByte = Math.min((i + 1) * bytesPerWorker, totalBytes);
		const workerChunks = Math.ceil((endByte - startByte) / chunkSize);

		if (workerChunks <= 0) continue;

		let pos = startByte;
		ranges.push({
			range: new ReadableStream<Uint8Array>({
				async pull(controller) {
					while (pos < endByte) {
						const take = Math.min(endByte - pos, chunkSize);
						controller.enqueue(fullBuffer.slice(pos, pos + take));
						pos += take;
					}
					controller.close();
				}
			}),
			startChunkIndex: globalChunkIndex
		});

		globalChunkIndex += workerChunks;
	}

	return ranges;
}

interface FileWithRelativePath extends File {
	relativePath?: string;
}

async function writeZipFiles(
	zipWriter: ZipWriter<any>,
	writable: WritableStream<Uint8Array>,
	files: File[],
	password?: string,
	signal?: AbortSignal
) {
	const options = {
		password: password?.length ? password : undefined,
		encryptionStrength: password?.length ? 3 : undefined,
		level: 9,
		signal
	} as const;

	try {
		for (const file of files) {
			const displayName = (file as FileWithRelativePath).relativePath ?? file.name;
			const uniqueName = makeUnique(displayName);

			try {
				await zipWriter.add(uniqueName, file.stream(), options);
			} catch (err) {
				const msg = String((err as Error).message ?? String(err) ?? '');
				if (msg.includes('File already exists') || msg.includes('already exists')) {
					const altName = makeUnique(displayName);
					await zipWriter.add(altName, file.stream(), options);
				} else {
					throw err;
				}
			}
		}
		await zipWriter.close();
	} catch (error) {
		console.error('Error creating zip stream:', error);
		try {
			await writable.abort(error);
		} catch {}
	}
}

export async function createZipStream(
	files: File[],
	password?: string,
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const { readable, writable } = new TransformStream();
	const zipWriter = new ZipWriter(writable, {
		bufferedWrite: true,
		useCompressionStream: true
	});
	writeZipFiles(zipWriter, writable, files, password, signal);
	return readable;
}

// Shared worker setup for encryption/decryption
function createWorkerStream(
	input: ReadableStream<Uint8Array>,
	keyCopy: ArrayBuffer,
	ivCopy: ArrayBuffer,
	messageType: 'encrypted' | 'decrypted',
	onProgress?: (bytes: number) => void
) {
	let worker: Worker | null = null;

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			worker = new (await EncryptionWorker)();
			let initialized = false;
			let bytesProcessed = 0;

			worker.onmessage = (ev) => {
				if (!initialized && ev.data?.type === 'init') {
					initialized = true;
					worker!.postMessage({ type: 'init' as const, keyRaw: keyCopy, baseIv: ivCopy }, [
						keyCopy,
						ivCopy
					]);
					return;
				}
				if (ev.data?.type === messageType) {
					const buf = ev.data[messageType];
					bytesProcessed += buf.byteLength;
					controller.enqueue(new Uint8Array(buf));
					onProgress?.(bytesProcessed);
				}
			};

			const io = new TransformStream<Uint8Array, Uint8Array>();
			let chunkIndex = 0;

			async function pump() {
				try {
					for await (const chunk of io.readable) {
						worker!.postMessage({ type: 'data' as const, index: chunkIndex++, chunk }, [chunk]);
					}
				} catch {}
			}

			pump();
			input.pipeTo(io.writable).catch(() => {});
		},
		cancel() {
			if (worker)
				try {
					worker.terminate();
				} catch {}
		}
	});
}

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void,
	ikm_override?: Uint8Array
) {
	const ikm = ikm_override ?? crypto.getRandomValues(new Uint8Array(32));
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
	const keyCopy = keyRaw.slice(0) as ArrayBuffer;
	const ivCopy = baseIv.buffer.slice(0) as ArrayBuffer;

	const ranges = await splitInputRanges(inputStream, STREAM_CHUNK_SIZE, WORKER_CONCURRENCY);

	return {
		stream: concatStreams(
			ranges.map(({ range }) =>
				createWorkerStream(range, keyCopy, ivCopy, 'encrypted', (bytes) =>
					onProgress?.(bytes, originalSize)
				)
			)
		),
		keySecret: base64url(ikm)
	};
}

export async function createDecryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	keySecret: string,
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void
) {
	const ikm = base64urlToBytes(keySecret);
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
	const keyCopy = keyRaw.slice(0) as ArrayBuffer;
	const ivCopy = baseIv.buffer.slice(0) as ArrayBuffer;

	const TAG_LEN = 16; // AES-GCM tag length
	const CHUNK_WITH_TAG = STREAM_CHUNK_SIZE + TAG_LEN;
	const totalChunks = Math.ceil((originalSize ?? 0) / STREAM_CHUNK_SIZE);
	const chunksPerWorker = Math.ceil(totalChunks / WORKER_CONCURRENCY);

	return {
		stream: concatStreams(
			Array.from({ length: WORKER_CONCURRENCY }, (_, i) =>
				createDecryptionWorkerStream(
					inputStream,
					keyCopy,
					ivCopy,
					i * chunksPerWorker,
					Math.min((i + 1) * chunksPerWorker, totalChunks),
					CHUNK_WITH_TAG,
					(bytes) => onProgress?.(bytes, originalSize)
				)
			)
		),
		keySecret: base64url(ikm)
	};
}

function createDecryptionWorkerStream(
	inputStream: ReadableStream<Uint8Array>,
	keyCopy: ArrayBuffer,
	ivCopy: ArrayBuffer,
	startChunkIndex: number,
	endChunkIndex: number,
	chunkWithTagSize: number,
	onProgress?: (bytes: number) => void
) {
	const EncryptionWorker = (async () =>
		(await import('#workers/encryption.worker?worker')).default)();

	let worker: Worker | null = null;

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			worker = new (await EncryptionWorker)();
			let initialized = false;
			let bytesProcessed = 0;
			let chunkIndex = startChunkIndex;

			worker.onmessage = (ev) => {
				if (!initialized && ev.data?.type === 'init') {
					initialized = true;
					worker!.postMessage({ type: 'init' as const, keyRaw: keyCopy, baseIv: ivCopy }, [
						keyCopy,
						ivCopy
					]);
					return;
				}
				if (ev.data?.type === 'decrypted') {
					const buf = ev.data.decrypted;
					bytesProcessed += buf.byteLength;
					controller.enqueue(new Uint8Array(buf));
					onProgress?.(bytesProcessed);
				}
			};

			const io = new TransformStream<Uint8Array, Uint8Array>();
			const outputReader = io.readable.getReader();

			async function pumpOutput() {
				try {
					while (true) {
						const { done, value } = await outputReader.read();
						if (done) break;
						worker!.postMessage({ type: 'data' as const, index: chunkIndex++, chunk: value }, [
							value
						]);
					}
				} catch {}
			}

			pumpOutput();

			const reader = inputStream.getReader();
			let buffer = new Uint8Array(0);

			try {
				while (chunkIndex < endChunkIndex) {
					while (buffer.length < chunkWithTagSize) {
						const { done, value } = await reader.read();
						if (done) break;
						const newBuf = new Uint8Array(buffer.length + value.length);
						newBuf.set(buffer);
						newBuf.set(value, buffer.length);
						buffer = newBuf;
					}

					const currentChunkSize = Math.min(buffer.length, chunkWithTagSize);
					const chunkData = buffer.slice(0, currentChunkSize);
					buffer = buffer.slice(currentChunkSize);
					await io.writable.getWriter().write(new Uint8Array(chunkData.buffer));
					chunkIndex++;
				}
			} finally {
				await reader.cancel();
				try {
					io.writable.getWriter().close();
				} catch {}
			}
		},
		cancel() {
			if (worker)
				try {
					worker.terminate();
				} catch {}
		}
	});
}

function concatStreams<T>(streams: ReadableStream<T>[]): ReadableStream<T> {
	let currentIndex = 0;

	async function pullFromNext(controller: ReadableStreamDefaultController<T>) {
		if (currentIndex >= streams.length) {
			controller.close();
			return;
		}

		const reader = streams[currentIndex].getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				controller.enqueue(value);
			}
		} finally {
			reader.releaseLock();
		}
		currentIndex++;

		await pullFromNext(controller);
	}

	return new ReadableStream<T>({
		async pull(controller) {
			if (currentIndex === 0) {
				await pullFromNext(controller);
			}
		},
		cancel() {
			for (let i = 0; i < streams.length; i++) {
				streams[i].cancel().catch(() => {});
			}
		}
	});
}
