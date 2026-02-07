import { WORKER_CONCURRENCY } from '#consts/concurrency';
import DecryptWorker from '#workers/decrypt.worker?worker';
import EncryptWorker from '#workers/encrypt.worker?worker';
import { ZipWriter, configure } from '@zip.js/zip.js';
import {
	CHUNK_SIZE,
	argon2Derive,
	base64url,
	base64urlToBytes,
	deriveAESKeyFromIKM,
	getChunkIv,
	xorBytes
} from './encryption';

configure({
	useWebWorkers: true,
	maxWorkers: WORKER_CONCURRENCY
});

// Deterministic derivation constants
const HKDF_SALT_STR = 'chithi-salt-v1';
const HKDF_IV_STR = 'chithi-iv-v1';

async function deriveSecrets(ikm: Uint8Array, password?: string) {
	// Derive deterministic salt from IKM
	const enc = new TextEncoder();
	const derivedSalt = await crypto.subtle.digest(
		'SHA-256',
		new Uint8Array([...ikm, ...enc.encode(HKDF_SALT_STR)])
	);

	let finalIKM = ikm;

	// Mix in password if provided
	if (password && password.length > 0) {
		const saltBytes = new Uint8Array(derivedSalt).slice(0, 16);
		const passwordBytes = new TextEncoder().encode(password);
		const pb = await argon2Derive(passwordBytes, saltBytes, 32, 16384, 32, 1);
		finalIKM = xorBytes(ikm, pb);
	}

	// Derive AES key and base IV
	const hkdfSalt = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode('aes-key')]))
	).slice(0, 16);

	const baseIv = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode(HKDF_IV_STR)]))
	).slice(0, 12);

	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	return { aesKey, baseIv, finalIKM };
}

interface EncryptionContext {
	chunkSizes: Map<number, number>;
	processedTotal: number;
	workers: Worker[];
	nextWorker: number;
	encryptedMap: Map<number, Uint8Array>;
	nextToEnqueue: number;
	pendingCount: number;
	allDoneResolve: (() => void) | null;
	allDoneReject: ((e: any) => void) | null;
	streamEnded: boolean;
	controllerRef: TransformStreamDefaultController<Uint8Array> | null;
	originalSize?: number;
	onProgress?: (processed: number, total?: number) => void;
}

async function handleEncryptionError(ctx: EncryptionContext, e: any): Promise<void> {
	if (ctx.allDoneReject) ctx.allDoneReject(e);
	if (ctx.controllerRef) ctx.controllerRef.error(e);
}

async function handleWorkerEncryptedMessage(ctx: EncryptionContext, data: any): Promise<void> {
	if (data?.type === 'encrypted') {
		ctx.pendingCount--;
		ctx.encryptedMap.set(data.index, new Uint8Array(data.encrypted));
		while (ctx.encryptedMap.has(ctx.nextToEnqueue)) {
			const arr = ctx.encryptedMap.get(ctx.nextToEnqueue)!;
			ctx.encryptedMap.delete(ctx.nextToEnqueue);
			ctx.controllerRef!.enqueue(arr);
			ctx.nextToEnqueue++;
			const sz = ctx.chunkSizes.get(ctx.nextToEnqueue - 1) || 0;
			ctx.processedTotal += sz;
			if (ctx.onProgress) ctx.onProgress(ctx.processedTotal, ctx.originalSize);
		}

		if (ctx.streamEnded && ctx.pendingCount === 0) {
			if (ctx.allDoneResolve) ctx.allDoneResolve();
			if (ctx.onProgress) ctx.onProgress(ctx.originalSize ?? ctx.processedTotal, ctx.originalSize);
		}
	} else if (data?.type === 'error') {
		await handleEncryptionError(ctx, new Error(data.message || 'Worker error'));
	}
}

async function initializeEncryptionWorkers(
	ctx: EncryptionContext,
	aesKey: CryptoKey,
	baseIv: Uint8Array,
	concurrency: number
): Promise<void> {
	try {
		const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
		for (let i = 0; i < concurrency; i++) {
			const w = new EncryptWorker();
			w.onmessage = (ev) => handleWorkerEncryptedMessage(ctx, ev.data);
			ctx.workers.push(w);
			const keyCopy = keyRaw.slice(0);
			const ivCopy = baseIv.buffer.slice(0);
			w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
		}
	} catch (e) {
		ctx.workers.length = 0;
		await handleEncryptionError(ctx, e);
	}
}

async function encryptChunkWithWorker(
	ctx: EncryptionContext,
	index: number,
	chunkData: Uint8Array
): Promise<void> {
	ctx.pendingCount++;
	const transferable = chunkData.buffer.slice(
		chunkData.byteOffset,
		chunkData.byteOffset + chunkData.byteLength
	);
	const w = ctx.workers[ctx.nextWorker];
	ctx.nextWorker = (ctx.nextWorker + 1) % ctx.workers.length;
	w.postMessage({ type: 'encrypt', index, chunk: transferable }, [transferable]);
}

async function encryptChunkFallback(
	ctx: EncryptionContext,
	index: number,
	chunkData: Uint8Array,
	aesKey: CryptoKey,
	baseIv: Uint8Array
): Promise<void> {
	ctx.pendingCount++;
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
		ctx.pendingCount--;
		ctx.encryptedMap.set(index, new Uint8Array(encrypted));
		while (ctx.encryptedMap.has(ctx.nextToEnqueue)) {
			const arr = ctx.encryptedMap.get(ctx.nextToEnqueue)!;
			ctx.encryptedMap.delete(ctx.nextToEnqueue);
			ctx.controllerRef!.enqueue(arr);
			ctx.nextToEnqueue++;
			const szInline = ctx.chunkSizes.get(ctx.nextToEnqueue - 1) ?? chunkData.byteLength;
			ctx.processedTotal += szInline;
			if (ctx.onProgress) ctx.onProgress(ctx.processedTotal, ctx.originalSize);
		}
		if (ctx.streamEnded && ctx.pendingCount === 0) {
			if (ctx.allDoneResolve) ctx.allDoneResolve();
			if (ctx.onProgress) ctx.onProgress(ctx.originalSize ?? ctx.processedTotal, ctx.originalSize);
		}
	} catch (err) {
		await handleEncryptionError(ctx, err);
	}
}

async function assignEncryptionChunk(
	ctx: EncryptionContext,
	index: number,
	chunkData: Uint8Array,
	aesKey: CryptoKey,
	baseIv: Uint8Array
): Promise<void> {
	if (ctx.workers.length > 0) {
		await encryptChunkWithWorker(ctx, index, chunkData);
	} else {
		await encryptChunkFallback(ctx, index, chunkData, aesKey, baseIv);
	}
}

interface DecryptionContext {
	workers: Worker[];
	nextWorker: number;
	decryptedMap: Map<number, Uint8Array>;
	nextToEnqueue: number;
	pendingCount: number;
	allDoneResolve: (() => void) | null;
	allDoneReject: ((e: any) => void) | null;
	streamEnded: boolean;
	controllerRef: ReadableStreamDefaultController<Uint8Array> | null;
}

async function handleDecryptionError(ctx: DecryptionContext, e: any): Promise<void> {
	if (ctx.allDoneReject) ctx.allDoneReject(e);
	if (ctx.controllerRef) ctx.controllerRef.error(e);
}

async function handleWorkerDecryptedMessage(ctx: DecryptionContext, data: any): Promise<void> {
	if (data?.type === 'decrypted') {
		ctx.pendingCount--;
		ctx.decryptedMap.set(data.index, new Uint8Array(data.decrypted));
		while (ctx.decryptedMap.has(ctx.nextToEnqueue)) {
			const arr = ctx.decryptedMap.get(ctx.nextToEnqueue)!;
			ctx.decryptedMap.delete(ctx.nextToEnqueue);
			ctx.controllerRef!.enqueue(arr);
			ctx.nextToEnqueue++;
		}
		if (ctx.streamEnded && ctx.pendingCount === 0 && ctx.allDoneResolve) {
			ctx.allDoneResolve();
		}
	} else if (data?.type === 'error') {
		const err = new Error(data.message || 'Worker error');
		if (data.name) err.name = data.name;
		await handleDecryptionError(ctx, err);
	}
}

async function initializeDecryptionWorkers(
	ctx: DecryptionContext,
	aesKey: CryptoKey,
	baseIv: Uint8Array,
	concurrency: number
): Promise<void> {
	try {
		const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
		for (let i = 0; i < concurrency; i++) {
			const w = new DecryptWorker();
			w.onmessage = (ev) => handleWorkerDecryptedMessage(ctx, ev.data);
			ctx.workers.push(w);
			const keyCopy = keyRaw.slice(0);
			const ivCopy = baseIv.buffer.slice(0);
			w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
		}
	} catch (e) {
		ctx.workers.length = 0;
		await handleDecryptionError(ctx, e);
	}
}

async function decryptChunkWithWorker(
	ctx: DecryptionContext,
	index: number,
	chunkBuf: Uint8Array
): Promise<void> {
	ctx.pendingCount++;
	const transferable = chunkBuf.buffer.slice(
		chunkBuf.byteOffset,
		chunkBuf.byteOffset + chunkBuf.byteLength
	);
	const w = ctx.workers[ctx.nextWorker];
	ctx.nextWorker = (ctx.nextWorker + 1) % ctx.workers.length;
	w.postMessage({ type: 'decrypt', index, chunk: transferable }, [transferable]);
}

async function decryptChunkFallback(
	ctx: DecryptionContext,
	index: number,
	chunkBuf: Uint8Array,
	aesKey: CryptoKey,
	baseIv: Uint8Array
): Promise<void> {
	ctx.pendingCount++;
	try {
		const iv = getChunkIv(baseIv, index);
		const buf = chunkBuf.buffer as ArrayBuffer;
		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, aesKey, buf);
		ctx.pendingCount--;
		ctx.decryptedMap.set(index, new Uint8Array(decrypted));
		if (ctx.controllerRef) {
			while (ctx.decryptedMap.has(ctx.nextToEnqueue)) {
				const arr = ctx.decryptedMap.get(ctx.nextToEnqueue)!;
				ctx.decryptedMap.delete(ctx.nextToEnqueue);
				ctx.controllerRef.enqueue(arr);
				ctx.nextToEnqueue++;
			}
		}
		if (ctx.streamEnded && ctx.pendingCount === 0 && ctx.allDoneResolve) {
			ctx.allDoneResolve();
		}
	} catch (err) {
		await handleDecryptionError(ctx, err);
	}
}

async function assignDecryptionChunk(
	ctx: DecryptionContext,
	index: number,
	chunkBuf: Uint8Array,
	aesKey: CryptoKey,
	baseIv: Uint8Array
): Promise<void> {
	if (ctx.workers.length > 0) {
		await decryptChunkWithWorker(ctx, index, chunkBuf);
	} else {
		await decryptChunkFallback(ctx, index, chunkBuf, aesKey, baseIv);
	}
}

async function writeZipFiles(
	zipWriter: ZipWriter<any>,
	writable: WritableStream<Uint8Array>,
	files: File[],
	password?: string,
	signal?: AbortSignal
): Promise<void> {
	try {
		for (const file of files) {
			const filename = (file as any).relativePath || file.name;
			await zipWriter.add(filename, file.stream(), {
				password: password?.length ? password : undefined,
				// prefer strongest WinZip AES (1..3 => 128,192,256). Use 3 for AES-256 compatibility.
				encryptionStrength: password?.length ? 3 : undefined,
				level: 9,
				signal
			});
		}
		await zipWriter.close();
	} catch (error) {
		console.error('Error creating zip stream:', error);
		try {
			await writable.abort(error);
		} catch (e) {
			// ignore
		}
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

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void
) {
	const ikm = crypto.getRandomValues(new Uint8Array(32));
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	let buffer = new Uint8Array(0);
	let chunkIndex = 0;
	let allDonePromise: Promise<void> | null = null;

	const ctx: EncryptionContext = {
		chunkSizes: new Map<number, number>(),
		processedTotal: 0,
		workers: [],
		nextWorker: 0,
		encryptedMap: new Map<number, Uint8Array>(),
		nextToEnqueue: 0,
		pendingCount: 0,
		allDoneResolve: null,
		allDoneReject: null,
		streamEnded: false,
		controllerRef: null,
		originalSize,
		onProgress
	};

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		async start(controller) {
			ctx.controllerRef = controller;
			ctx.workers = [];
			ctx.nextWorker = 0;
			ctx.encryptedMap.clear();
			ctx.nextToEnqueue = 0;
			ctx.pendingCount = 0;
			ctx.allDoneResolve = null;
			ctx.allDoneReject = null;
			ctx.streamEnded = false;

			allDonePromise = new Promise<void>((res, rej) => {
				ctx.allDoneResolve = res;
				ctx.allDoneReject = rej;
			});

			await initializeEncryptionWorkers(ctx, aesKey, baseIv, WORKER_CONCURRENCY);
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
				ctx.chunkSizes.set(index, chunkData.byteLength);
				await assignEncryptionChunk(ctx, index, chunkData, aesKey, baseIv);
			}
		},
		async flush(controller) {
			if (buffer.length > 0 || chunkIndex === 0) {
				const chunkData = buffer.slice(0);
				const index = chunkIndex++;
				ctx.chunkSizes.set(index, chunkData.byteLength);
				await assignEncryptionChunk(ctx, index, chunkData, aesKey, baseIv);
			}
			ctx.streamEnded = true;
			if (ctx.pendingCount > 0) {
				try {
					await allDonePromise;
				} catch (e) {
					throw e;
				}
			}
			try {
				for (const w of ctx.workers) w.terminate();
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
	const ikm = base64urlToBytes(keySecret);
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);

	const TAG_LEN = 16;
	const ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN;
	let chunkIndex = 0;

	const ctx: DecryptionContext = {
		workers: [],
		nextWorker: 0,
		decryptedMap: new Map<number, Uint8Array>(),
		nextToEnqueue: 0,
		pendingCount: 0,
		allDoneResolve: null,
		allDoneReject: null,
		streamEnded: false,
		controllerRef: null
	};

	const allDonePromise = new Promise<void>((res, rej) => {
		ctx.allDoneResolve = res;
		ctx.allDoneReject = rej;
	});

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			ctx.controllerRef = controller;
			await initializeDecryptionWorkers(ctx, aesKey, baseIv, WORKER_CONCURRENCY);
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
				if (ctx.pendingCount === 0) {
					controller.close();
					return;
				}
				ctx.streamEnded = true;
				await allDonePromise;
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
			await assignDecryptionChunk(ctx, index, chunkData, aesKey, baseIv);

			if (isLast && ctx.pendingCount === 0) {
				while (ctx.decryptedMap.has(ctx.nextToEnqueue)) {
					const arr = ctx.decryptedMap.get(ctx.nextToEnqueue)!;
					ctx.decryptedMap.delete(ctx.nextToEnqueue);
					controller.enqueue(arr);
					ctx.nextToEnqueue++;
				}
				controller.close();
			}
		},
		async cancel() {
			for (const w of ctx.workers) {
				try {
					w.terminate();
				} catch (e) {}
			}
		}
	});

	allDonePromise
		.then(async () => {
			for (const w of ctx.workers) w.terminate();
		})
		.catch(async () => {
			for (const w of ctx.workers) w.terminate();
		});

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
