import { WORKER_CONCURRENCY } from '#consts/concurrency';
import { HKDF_IV_STR, HKDF_SALT_STR } from '#consts/encryption';
import DecryptWorker from '#workers/crypto/decrypt.worker?worker';
import EncryptWorker from '#workers/crypto/encrypt.worker?worker';
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

const usedNames = new Map<string, number>();
const makeUnique = (name: string) => {
	if (!usedNames.has(name)) {
		usedNames.set(name, 1);
		return name;
	}
	const count = usedNames.get(name) || 1;
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
		new Uint8Array([...ikm, ...enc.encode(HKDF_SALT_STR)])
	);
	let finalIKM = ikm;

	if (password?.length) {
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

/** Shared worker pool — handles init, round-robin dispatch, graceful fallback */
interface WorkerPoolCtx<T extends 'encrypt' | 'decrypt'> {
	workers: Worker[];
	nextWorker: number;
	resultMap: Map<number, Uint8Array>;
	nextToEnqueue: number;
	pendingCount: number;
	allDoneResolve: (() => void) | null;
	allDoneReject: ((e: any) => void) | null;
	streamEnded: boolean;
	controllerRef: ReadableStreamDefaultController<Uint8Array> | TransformStreamDefaultController<Uint8Array> | null;
	processedTotal: number;
	chunkSizes?: Map<number, number>;
	originalSize?: number;
	onProgress?: (processed: number, total?: number) => void;
}

type WorkerCtor = new () => Worker;

/** Initialize a pool of workers, falling back to main thread on failure */
async function initWorkerPool<T extends 'encrypt' | 'decrypt'>(
	ctx: WorkerPoolCtx<T>,
	WorkerClass: WorkerCtor,
	aesKey: CryptoKey,
	baseIv: Uint8Array,
	concurrency: number,
	onMessage: (data: any) => Promise<void>,
	label: string
): Promise<void> {
	const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
	const initPromises = Array.from({ length: concurrency }, (_, i) =>
		new Promise<Worker | null>((resolve) => {
			try {
				const w = new WorkerClass();
				let resolved = false;
				w.onmessage = (ev) => {
					if (ev.data?.type === 'ready' && !resolved) { resolved = true; resolve(w); }
					else onMessage(ev.data);
				};
				w.onerror = () => { if (!resolved) { resolved = true; console.warn(`${label} ${i} failed, falling back.`); resolve(null); } };
				const [kc, ivc] = [keyRaw.slice(0), baseIv.buffer.slice(0)];
				w.postMessage({ type: 'init', keyRaw: kc, baseIv: ivc }, [kc, ivc]);
			} catch { console.warn(`${label} instantiation failed.`); resolve(null); }
		})
	);
	ctx.workers = (await Promise.all(initPromises)).filter(Boolean) as Worker[];
	if (!ctx.workers.length) console.warn(`All ${label} workers failed. Using main-thread fallback.`);
}

/** Dispatch a chunk to the next available worker (round-robin) */
function dispatchToWorker<T extends 'encrypt' | 'decrypt'>(
	ctx: WorkerPoolCtx<T>,
	type: 'encrypt' | 'decrypt',
	index: number,
	chunk: Uint8Array
): void {
	ctx.pendingCount++;
	const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
	ctx.workers[ctx.nextWorker].postMessage({ type, index, chunk: buf }, [buf]);
	ctx.nextWorker = (ctx.nextWorker + 1) % ctx.workers.length;
}

/** Enqueue results in order from the result map, update progress, signal done if all complete */
function flushInOrder<T extends 'encrypt' | 'decrypt'>(ctx: WorkerPoolCtx<T>, sizeFallback = 0): void {
	while (ctx.resultMap.has(ctx.nextToEnqueue)) {
		const arr = ctx.resultMap.get(ctx.nextToEnqueue)!;
		ctx.resultMap.delete(ctx.nextToEnqueue);
		ctx.controllerRef!.enqueue(arr);
		const sz = ctx.chunkSizes?.get(ctx.nextToEnqueue) ?? sizeFallback ?? arr.byteLength;
		ctx.processedTotal += sz;
		ctx.nextToEnqueue++;
		ctx.onProgress?.(ctx.processedTotal, ctx.originalSize);
	}
	if (ctx.streamEnded && ctx.pendingCount === 0 && ctx.allDoneResolve) {
		ctx.onProgress?.(ctx.originalSize ?? ctx.processedTotal, ctx.originalSize);
		ctx.allDoneResolve();
	}
}

function handleError<T extends 'encrypt' | 'decrypt'>(ctx: WorkerPoolCtx<T>, e: Error): void {
	ctx.allDoneReject?.(e);
	ctx.controllerRef?.error(e);
}

/** Encrypt or decrypt a chunk — uses workers if available, otherwise main-thread crypto */
async function processChunk<T extends 'encrypt' | 'decrypt'>(
	ctx: WorkerPoolCtx<T>,
	index: number,
	chunk: Uint8Array,
	aesKey: CryptoKey,
	baseIv: Uint8Array,
	op: 'encrypt' | 'decrypt'
): Promise<void> {
	if (ctx.workers.length) { dispatchToWorker(ctx, op, index, chunk); return; }
	ctx.pendingCount++;
	try {
		const iv = getChunkIv(baseIv, index);
		const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
		const result = await crypto.subtle[op]({ name: 'AES-GCM', iv: iv as any }, aesKey, buf as ArrayBuffer);
		ctx.pendingCount--;
		ctx.resultMap.set(index, new Uint8Array(result));
		flushInOrder(ctx, chunk.byteLength);
	} catch (err) { handleError(ctx, err as Error); }
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
			let filename = (file as any).relativePath || file.name;
			filename = makeUnique(filename);
			try {
				await zipWriter.add(filename, file.stream(), {
					password,
					encryptionStrength: password?.length ? 3 : undefined,
					level: 9,
					signal
				});
			} catch (err: any) {
				const msg = String(err?.message || err || '');
				if (msg.includes('File already exists') || msg.includes('already exists')) {
					const altName = makeUnique((file as any).relativePath || file.name);
					await zipWriter.add(altName, file.stream(), {
						password,
						encryptionStrength: password?.length ? 3 : undefined,
						level: 9,
						signal
					});
				} else {
					throw err;
				}
			}
		}
		await zipWriter.close();
	} catch (error) {
		console.error('Error creating zip stream:', error);
		writable.abort(error).catch(() => {});
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
	onProgress?: (processed: number, total?: number) => void,
	ikm_override?: Uint8Array
) {
	const ikm = ikm_override ?? crypto.getRandomValues(new Uint8Array(32));
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);
	const chunks: Uint8Array[] = [];
	let bufferedBytes = 0, chunkIndex = 0;

	const ctx: WorkerPoolCtx<'encrypt'> = {
		workers: [], nextWorker: 0, resultMap: new Map(), nextToEnqueue: 0,
		pendingCount: 0, allDoneResolve: null, allDoneReject: null, streamEnded: false,
		controllerRef: null, processedTotal: 0, chunkSizes: new Map(), originalSize, onProgress
	};
	const allDonePromise = new Promise<void>((res, rej) => { ctx.allDoneResolve = res; ctx.allDoneReject = rej; });

	function readChunk(size: number): Uint8Array {
		const out = new Uint8Array(size);
		let offset = 0;
		while (offset < size) {
			const first = chunks[0]!;
			const take = Math.min(first.length, size - offset);
			out.set(first.subarray(0, take), offset);
			chunks[0] = take === first.length ? chunks.shift()! : first.subarray(take);
			offset += take; bufferedBytes -= take;
		}
		return out;
	}

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		async start(controller) {
			ctx.controllerRef = controller;
			await initWorkerPool(ctx, EncryptWorker, aesKey, baseIv, WORKER_CONCURRENCY,
				async (data) => { if (data?.type === 'encrypted') { ctx.pendingCount--; ctx.resultMap.set(data.index, new Uint8Array(data.encrypted)); flushInOrder(ctx); } else handleError(ctx, new Error(data?.message || 'Worker error')); },
				'EncryptWorker');
		},
		async transform(chunk) {
			chunks.push(chunk); bufferedBytes += chunk.length;
			while (bufferedBytes >= CHUNK_SIZE) {
				const cd = readChunk(CHUNK_SIZE);
				ctx.chunkSizes!.set(chunkIndex, cd.byteLength);
				await processChunk(ctx, chunkIndex++, cd, aesKey, baseIv, 'encrypt');
			}
		},
		async flush() {
			if (bufferedBytes > 0 || chunkIndex === 0) {
				const cd = readChunk(bufferedBytes);
				ctx.chunkSizes!.set(chunkIndex, cd.byteLength);
				await processChunk(ctx, chunkIndex++, cd, aesKey, baseIv, 'encrypt');
			}
			ctx.streamEnded = true;
			if (ctx.pendingCount > 0) await allDonePromise;
			ctx.workers.forEach(w => { try { w.terminate(); } catch { /* noop */ } });
		}
	});

	return { stream: inputStream.pipeThrough(transformer), keySecret: base64url(ikm) };
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
	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);
	const TAG_LEN = 16, ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN, chunkIndex = { current: 0 };

	const ctx: WorkerPoolCtx<'decrypt'> = {
		workers: [], nextWorker: 0, resultMap: new Map(), nextToEnqueue: 0,
		pendingCount: 0, allDoneResolve: null, allDoneReject: null, streamEnded: false,
		controllerRef: null, processedTotal: 0, originalSize, onProgress
	};
	const allDonePromise = new Promise<void>((res, rej) => { ctx.allDoneResolve = res; ctx.allDoneReject = rej; });

	const termWorkers = () => ctx.workers.forEach(w => { try { w.terminate(); } catch { /* noop */ } });
	allDonePromise.then(termWorkers).catch(termWorkers);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			ctx.controllerRef = controller;
			await initWorkerPool(ctx, DecryptWorker, aesKey, baseIv, WORKER_CONCURRENCY,
				async (data) => {
					if (data?.type === 'decrypted') {
						ctx.pendingCount--;
						ctx.resultMap.set(data.index, new Uint8Array(data.decrypted));
						flushInOrder(ctx);
					} else {
						const err = new Error(data?.message || 'Worker error');
						if (data?.name) err.name = data.name;
						handleError(ctx, err);
					}
				},
				'DecryptWorker');
		},
		async pull(controller) {
			while (buffer.length < ENC_CHUNK_SIZE) {
				const { done, value } = await reader.read();
				if (done) break;
				const nb = new Uint8Array(buffer.length + value.length);
				nb.set(buffer); nb.set(value, buffer.length);
				buffer = nb;
			}
			if (!buffer.length) {
				if (!ctx.pendingCount) controller.close();
				else { ctx.streamEnded = true; await allDonePromise; controller.close(); }
				return;
			}
			const isLast = buffer.length < ENC_CHUNK_SIZE;
			const size = isLast ? buffer.length : ENC_CHUNK_SIZE;
			const chunkData = buffer.slice(0, size);
			buffer = buffer.slice(size);
			await processChunk(ctx, chunkIndex.current++, chunkData, aesKey, baseIv, 'decrypt');
			if (isLast && !ctx.pendingCount) {
				flushInOrder(ctx);
				controller.close();
			}
		},
		cancel() { termWorkers(); }
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
						return;
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
