import DecryptWorker from '#workers/decrypt.worker?worker';
import EncryptWorker from '#workers/encrypt.worker?worker';
import { ZipWriter } from '@zip.js/zip.js';
import {
	CHUNK_SIZE,
	argon2Derive,
	base64url,
	base64urlToBytes,
	deriveAESKeyFromIKM,
	getChunkIv,
	xorBytes
} from './encryption';

const CONCURRENCY = Math.max(1, navigator?.hardwareConcurrency * 2 || 4);

// Deterministic derivation constants (since we removed metadata)
const HKDF_SALT_STR = 'chithi-salt-v1';
const HKDF_IV_STR = 'chithi-iv-v1';

async function deriveSecrets(ikm: Uint8Array, password?: string) {
	// 1. Derive deterministic Salt from IKM
	const enc = new TextEncoder();
	// Since IKM is random per file, this salt is effectively unique per file
	const derivedSalt = await crypto.subtle.digest(
		'SHA-256',
		new Uint8Array([...ikm, ...enc.encode(HKDF_SALT_STR)])
	);

	let finalIKM = ikm;

	// 2. Mix in Password if provided
	if (password && password.length > 0) {
		const saltBytes = new Uint8Array(derivedSalt).slice(0, 16);
		// Argon2id
		const passwordBytes = new TextEncoder().encode(password);
		const pb = await argon2Derive(passwordBytes, saltBytes, 32, 16384, 32, 1);
		finalIKM = xorBytes(ikm, pb);
	}

	// 3. Derive AES Key and Base IV
	// Use HKDF-ish derivation logic by just hashing with context
	// (or re-use deriveAESKeyFromIKM which uses Argon2, but that's slow for just key expansion if we already did argon above)
	// We'll stick to the existing util which uses Argon2 with low internal cost

	// Create a deterministic "HKDF Salt" for key derivation from IKM
	const hkdfSalt = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode('aes-key')]))
	).slice(0, 16);

	// Create deterministic IV
	const baseIv = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode(HKDF_IV_STR)]))
	).slice(0, 12);

	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	return { aesKey, baseIv, finalIKM };
}

export async function createZipStream(
	files: File[],
	password?: string
): Promise<ReadableStream<Uint8Array>> {
	const { readable, writable } = new TransformStream();
	const zipWriter = new ZipWriter(writable);

	try {
		await Promise.all(
			files.map((file) => {
				const filename = (file as any).relativePath || file.name;
				return zipWriter.add(filename, file.stream(), {
					password: password?.length ? password : undefined
				});
			})
		);
		await zipWriter.close();
	} catch (error) {
		console.error('Error creating zip stream:', error);
		try {
			await writable.abort(error);
		} catch (e) {
			// ignore
		}
	}

	return readable;
}

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void
) {
	// 1. Generate IKM (The Source of Truth)
	const ikm = crypto.getRandomValues(new Uint8Array(32));

	// 2. Derive Keys (No metadata headers, everything derived from IKM + Password)
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	// 4. Create Transformer
	let buffer = new Uint8Array(0);
	let chunkIndex = 0;

	const chunkSizes = new Map<number, number>();
	let processedTotal = 0;
	let workers: Worker[] = [];
	let nextWorker = 0;
	let encryptedMap = new Map<number, Uint8Array>();
	let nextToEnqueue = 0;
	let pendingCount = 0;
	let allDonePromise: Promise<void> | null = null;
	let allDoneResolve: (() => void) | null = null;
	let allDoneReject: ((e: any) => void) | null = null;
	let streamEnded = false;
	let assignChunk: ((index: number, chunkData: Uint8Array) => void) | null = null;
	let controllerRef: TransformStreamDefaultController<Uint8Array> | null = null;

	const handleError = (e: any) => {
		if (allDoneReject) allDoneReject(e);
		if (controllerRef) controllerRef.error(e);
	};

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		async start(controller) {
			controllerRef = controller;
			// No Header is written to stream.

			// Setup worker pool
			const concurrency = CONCURRENCY;
			workers = [];
			nextWorker = 0;
			encryptedMap.clear();
			nextToEnqueue = 0;
			pendingCount = 0;
			allDoneResolve = null;
			allDoneReject = null;
			streamEnded = false;

			allDonePromise = new Promise<void>((res, rej) => {
				allDoneResolve = res;
				allDoneReject = rej;
			});

			const handleWorkerMessage = (data: any) => {
				if (data?.type === 'encrypted') {
					pendingCount--;
					encryptedMap.set(data.index, new Uint8Array(data.encrypted));
					while (encryptedMap.has(nextToEnqueue)) {
						const arr = encryptedMap.get(nextToEnqueue)!;
						encryptedMap.delete(nextToEnqueue);
						controller.enqueue(arr);
						nextToEnqueue++;
						const sz = chunkSizes.get(nextToEnqueue - 1) || 0;
						processedTotal += sz;
						if (onProgress) onProgress(processedTotal, originalSize);
					}

					if (streamEnded && pendingCount === 0) {
						if (allDoneResolve) allDoneResolve();
						if (onProgress) onProgress(originalSize ?? processedTotal, originalSize);
					}
				} else if (data?.type === 'error') {
					handleError(new Error(data.message || 'Worker error'));
				}
			};

			try {
				const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
				for (let i = 0; i < concurrency; i++) {
					const w = new EncryptWorker();
					w.onmessage = (ev) => handleWorkerMessage(ev.data);
					workers.push(w);
					const keyCopy = keyRaw.slice(0);
					const ivCopy = baseIv.buffer.slice(0);
					w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
				}
			} catch (e) {
				workers.length = 0;
				handleError(e);
			}

			assignChunk = async (index: number, chunkData: Uint8Array) => {
				pendingCount++;
				if (workers.length > 0) {
					const transferable = chunkData.buffer.slice(
						chunkData.byteOffset,
						chunkData.byteOffset + chunkData.byteLength
					);
					const w = workers[nextWorker];
					nextWorker = (nextWorker + 1) % workers.length;
					w.postMessage({ type: 'encrypt', index, chunk: transferable }, [transferable]);
				} else {
					try {
						const iv = getChunkIv(baseIv, index);
						const buf = chunkData.buffer.slice(
							chunkData.byteOffset,
							chunkData.byteOffset + chunkData.byteLength
						);
						const encrypted = await crypto.subtle.encrypt(
							{ name: 'AES-GCM', iv: iv as any },
							aesKey,
							buf as ArrayBuffer
						);
						pendingCount--;
						encryptedMap.set(index, new Uint8Array(encrypted));
						while (encryptedMap.has(nextToEnqueue)) {
							const arr = encryptedMap.get(nextToEnqueue)!;
							encryptedMap.delete(nextToEnqueue);
							controller.enqueue(arr);
							nextToEnqueue++;
							const szInline = chunkSizes.get(nextToEnqueue - 1) ?? chunkData.byteLength;
							processedTotal += szInline;
							if (onProgress) onProgress(processedTotal, originalSize);
						}
						if (streamEnded && pendingCount === 0) {
							if (allDoneResolve) allDoneResolve();
							if (onProgress) onProgress(originalSize ?? processedTotal, originalSize);
						}
					} catch (err) {
						handleError(err);
					}
				}
			};
		},
		async transform(chunk, controller) {
			const newBuffer = new Uint8Array(buffer.length + chunk.length);
			newBuffer.set(buffer);
			newBuffer.set(chunk, buffer.length);
			buffer = newBuffer;

			while (buffer.length >= CHUNK_SIZE) {
				const chunkData = buffer.slice(0, CHUNK_SIZE);
				buffer = buffer.slice(CHUNK_SIZE);
				const index = chunkIndex++;
				chunkSizes.set(index, chunkData.byteLength);
				if (assignChunk) assignChunk(index, chunkData);
			}
		},
		async flush(controller) {
			if (buffer.length > 0 || chunkIndex === 0) {
				const chunkData = buffer.slice(0);
				const index = chunkIndex++;
				chunkSizes.set(index, chunkData.byteLength);
				if (assignChunk) assignChunk(index, chunkData);
			}
			streamEnded = true;
			if (pendingCount > 0) {
				try {
					await allDonePromise;
				} catch (e) {
					throw e;
				}
			}
			try {
				for (const w of workers) w.terminate();
			} catch (e) {}
		}
	});

	return {
		stream: inputStream.pipeThrough(transformer),
		keySecret: base64url(ikm)
	};
}

export async function createDecryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	keySecret: string,
	password?: string
) {
	// 1. Recover Secrets
	const ikm = base64urlToBytes(keySecret);
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);

	const TAG_LEN = 16;
	const ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN;
	let chunkIndex = 0;

	// Worker pool state
	const concurrency = CONCURRENCY;
	const workers: Worker[] = [];
	let nextWorker = 0;
	const decryptedMap = new Map<number, Uint8Array>();
	let nextToEnqueue = 0;
	let pendingCount = 0;
	let allDoneResolve: (() => void) | null = null;
	let allDoneReject: ((e: any) => void) | null = null;
	let allDonePromise: Promise<void> | null = null;
	let streamEnded = false;
	let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

	const handleError = (e: any) => {
		if (allDoneReject) allDoneReject(e);
		if (controllerRef) controllerRef.error(e);
	};

	const startWorkers = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
		try {
			const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
			for (let i = 0; i < concurrency; i++) {
				const w = new DecryptWorker();
				w.onmessage = (ev) => {
					const data = ev.data;
					if (data?.type === 'decrypted') {
						pendingCount--;
						decryptedMap.set(data.index, new Uint8Array(data.decrypted));
						while (decryptedMap.has(nextToEnqueue)) {
							const arr = decryptedMap.get(nextToEnqueue)!;
							decryptedMap.delete(nextToEnqueue);
							controller.enqueue(arr);
							nextToEnqueue++;
						}
						if (streamEnded && pendingCount === 0 && allDoneResolve) allDoneResolve();
					} else if (data?.type === 'error') {
						const err = new Error(data.message || 'Worker error');
						if (data.name) err.name = data.name;
						handleError(err);
					}
				};
				workers.push(w);
				const keyCopy = keyRaw.slice(0);
				const ivCopy = baseIv.buffer.slice(0);
				w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
			}
		} catch (e) {
			workers.length = 0;
			handleError(e);
		}
	};

	const assignChunk = async (
		index: number,
		chunkBuf: Uint8Array,
		controller?: ReadableStreamDefaultController<Uint8Array>
	) => {
		pendingCount++;
		if (workers.length > 0) {
			const transferable = chunkBuf.buffer.slice(
				chunkBuf.byteOffset,
				chunkBuf.byteOffset + chunkBuf.byteLength
			);
			const w = workers[nextWorker];
			nextWorker = (nextWorker + 1) % workers.length;
			w.postMessage({ type: 'decrypt', index, chunk: transferable }, [transferable]);
		} else {
			try {
				const iv = getChunkIv(baseIv, index);
				const buf = chunkBuf.buffer as ArrayBuffer;
				const decrypted = await crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv: iv as any },
					aesKey,
					buf
				);
				pendingCount--;
				decryptedMap.set(index, new Uint8Array(decrypted));
				if (controller) {
					while (decryptedMap.has(nextToEnqueue)) {
						const arr = decryptedMap.get(nextToEnqueue)!;
						decryptedMap.delete(nextToEnqueue);
						controller.enqueue(arr);
						nextToEnqueue++;
					}
				}
				if (streamEnded && pendingCount === 0 && allDoneResolve) allDoneResolve();
			} catch (err) {
				handleError(err);
			}
		}
	};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			controllerRef = controller;
			allDonePromise = new Promise<void>((res, rej) => {
				allDoneResolve = res;
				allDoneReject = rej;
			});
			await startWorkers(controller);
		},
		async pull(controller) {
			while (buffer.length < ENC_CHUNK_SIZE) {
				const { done, value } = await reader.read();
				if (done) break;
				const newBuf = new Uint8Array(buffer.length + value.length);
				newBuf.set(buffer);
				newBuf.set(value, buffer.length);
				buffer = newBuf;
			}

			if (buffer.length === 0) {
				if (pendingCount === 0) {
					controller.close();
					return;
				}
				streamEnded = true;
				if (allDonePromise) await allDonePromise;
				controller.close();
				return;
			}

			let currentChunkSize = ENC_CHUNK_SIZE;
			let isLast = false;
			if (buffer.length < ENC_CHUNK_SIZE) {
				currentChunkSize = buffer.length;
				isLast = true;
			}

			const chunkData = buffer.slice(0, currentChunkSize);
			buffer = buffer.slice(currentChunkSize);

			const index = chunkIndex++;
			assignChunk(index, chunkData, controller);

			if (isLast && pendingCount === 0) {
				while (decryptedMap.has(nextToEnqueue)) {
					const arr = decryptedMap.get(nextToEnqueue)!;
					decryptedMap.delete(nextToEnqueue);
					controller.enqueue(arr);
					nextToEnqueue++;
				}
				controller.close();
			}
		},
		async cancel() {
			for (const w of workers) {
				try {
					w.terminate();
				} catch (e) {}
			}
		}
	});

	if (allDonePromise != null) {
		(allDonePromise as Promise<void>)
			.then(() => {
				for (const w of workers) w.terminate();
			})
			.catch(() => {
				for (const w of workers) w.terminate();
			});
	}

	return { stream };
}

export function createMultipartStream(
	boundary: string,
	fields: Record<string, string>,
	fileField: string,
	filename: string,
	fileStream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	// Construct preamble
	const preAmbleParts: Uint8Array[] = [];
	for (const [key, value] of Object.entries(fields)) {
		preAmbleParts.push(encoder.encode(`--${boundary}\r\n`));
		preAmbleParts.push(encoder.encode(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
		preAmbleParts.push(encoder.encode(`${value}\r\n`));
	}
	preAmbleParts.push(encoder.encode(`--${boundary}\r\n`));
	preAmbleParts.push(
		encoder.encode(
			`Content-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\n`
		)
	);
	preAmbleParts.push(encoder.encode(`Content-Type: application/octet-stream\r\n\r\n`));

	const postAmble = encoder.encode(`\r\n--${boundary}--\r\n`);

	let state: 'preamble' | 'file' | 'postamble' | 'done' = 'preamble';
	let preambleIndex = 0;
	let fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

	return new ReadableStream({
		async pull(controller) {
			while (true) {
				if (state === 'preamble') {
					if (preambleIndex < preAmbleParts.length) {
						controller.enqueue(preAmbleParts[preambleIndex]);
						preambleIndex++;
						return; // Yield to event loop
					} else {
						state = 'file';
						fileReader = fileStream.getReader();
						continue;
					}
				}

				if (state === 'file') {
					const { done, value } = await fileReader!.read();
					if (done) {
						state = 'postamble';
						continue;
					}
					controller.enqueue(value);
					return;
				}

				if (state === 'postamble') {
					controller.enqueue(postAmble);
					state = 'done';
					controller.close();
					return;
				}

				if (state === 'done') {
					controller.close();
					return;
				}
			}
		},
		cancel() {
			if (fileReader) {
				fileReader.cancel();
			} else {
				fileStream.cancel();
			}
		}
	});
}
