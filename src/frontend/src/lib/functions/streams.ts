import { WORKER_CONCURRENCY } from '#consts/concurrency';
import WasmPipelineWorker from '#workers/wasm-pipeline.worker?worker';
import {
	CHUNK_SIZE,
	argon2Derive,
	base64url,
	base64urlToBytes,
	deriveAESKeyFromIKM,
	xorBytes
} from './encryption';

// Deterministic derivation constants
const HKDF_SALT_STR = 'chithi-salt-v1';
const HKDF_IV_STR = 'chithi-iv-v1';

const usedNames = new Map<string, number>();

const makeUnique = (name: string) => {
	if (!usedNames.has(name)) {
		usedNames.set(name, 1);
		return name;
	}

	const count = usedNames.get(name) || 1;
	usedNames.set(name, count + 1);

	// Preserve extension when adding suffix
	const lastDot = name.lastIndexOf('.');
	if (lastDot > 0) {
		const base = name.slice(0, lastDot);
		const ext = name.slice(lastDot);
		return `${base}_${count}${ext}`;
	}
	return `${name}_${count}`;
};

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

/**
 * Creates a stream that packs multiple files into a single stream for the WASM pipeline.
 * Format: [4 bytes filename length][filename][8 bytes file size][file data]...
 */
export async function createPackedStream(files: File[]): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let currentFileIndex = 0;
	let currentFileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let state: 'header' | 'data' = 'header';

	return new ReadableStream({
		async pull(controller) {
			if (currentFileIndex >= files.length) {
				controller.close();
				return;
			}

			const file = files[currentFileIndex];

			if (state === 'header') {
				const filename = (file as any).relativePath || file.name;
				const filenameBytes = encoder.encode(filename);

				const header = new Uint8Array(4 + filenameBytes.length + 8);
				const view = new DataView(header.buffer);

				view.setUint32(0, filenameBytes.length, false);
				header.set(filenameBytes, 4);
				view.setBigUint64(4 + filenameBytes.length, BigInt(file.size), false);

				controller.enqueue(header);
				state = 'data';
				currentFileReader = file.stream().getReader();
			} else {
				const { done, value } = await currentFileReader!.read();
				if (done) {
					state = 'header';
					currentFileIndex++;
					currentFileReader = null;
					return;
				}
				controller.enqueue(value);
			}
		},
		cancel() {
			if (currentFileReader) currentFileReader.cancel();
		}
	});
}

/**
 * Unpacks a packed stream into individual Blobs.
 */
export async function unpackStream(
	stream: ReadableStream<Uint8Array>
): Promise<{ filename: string; blob: Blob }[]> {
	const reader = stream.getReader();
	let buffer = new Uint8Array(0);
	const decoder = new TextDecoder();
	const results: { filename: string; blob: Blob }[] = [];

	async function ensure(size: number) {
		while (buffer.length < size) {
			const { done, value } = await reader.read();
			if (done) return false;
			const newBuf = new Uint8Array(buffer.length + value.length);
			newBuf.set(buffer);
			newBuf.set(value, buffer.length);
			buffer = newBuf;
		}
		return true;
	}

	while (true) {
		if (!(await ensure(4))) break;
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		const nameLen = view.getUint32(0, false);
		buffer = buffer.slice(4);

		if (!(await ensure(nameLen + 8))) throw new Error('Malformed packed stream');
		const filename = decoder.decode(buffer.slice(0, nameLen));
		buffer = buffer.slice(nameLen);

		const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		const dataSize = Number(dataView.getBigUint64(0, false));
		buffer = buffer.slice(8);

		const chunks: Uint8Array[] = [];
		let remaining = dataSize;

		while (remaining > 0) {
			if (buffer.length > 0) {
				const take = Math.min(buffer.length, remaining);
				chunks.push(buffer.slice(0, take));
				buffer = buffer.slice(take);
				remaining -= take;
			} else {
				const { done, value } = await reader.read();
				if (done) throw new Error('Unexpected end of stream');
				const take = Math.min(value.length, remaining);
				chunks.push(value.slice(0, take));
				if (value.length > take) {
					buffer = value.slice(take);
				}
				remaining -= take;
			}
		}

		// Ensure we provide plain ArrayBuffers (not SharedArrayBuffer) to Blob
		const parts = chunks.map((c) => {
			const ab = new ArrayBuffer(c.byteLength);
			new Uint8Array(ab).set(c);
			return ab;
		});
		results.push({ filename, blob: new Blob(parts) });
	}

	return results;
}

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void,
	ikm_override?: Uint8Array,
	useCompression = true
) {
	const ikm = ikm_override ?? crypto.getRandomValues(new Uint8Array(32));
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const worker = new WasmPipelineWorker();
	let readyResolve: () => void;
	let readyReject: (reason?: any) => void;
	const readyPromise = new Promise<void>((resolve, reject) => {
		readyResolve = resolve;
		readyReject = reject;
	});

	const pendingChunks = new Map<number, Uint8Array>();
	let nextChunkToEnqueue = 0;
	let processedTotal = 0;
	let streamController: TransformStreamDefaultController<Uint8Array> | undefined;
	let resolveAll: () => void;
	let rejectAll: (e: any) => void;
	const allDonePromise = new Promise<void>((res, rej) => {
		resolveAll = res;
		rejectAll = rej;
	});
	let activeCount = 0;
	let inputEnded = false;

	worker.onmessage = (ev) => {
		const data = ev.data;
		if (data.type === 'ready') {
			readyResolve();
		} else if (data.type === 'encrypted') {
			activeCount--;
			const chunkData = new Uint8Array(data.data);
			const prefixed = new Uint8Array(4 + chunkData.length);
			const view = new DataView(prefixed.buffer);
			view.setUint32(0, chunkData.length, false);
			prefixed.set(chunkData, 4);

			pendingChunks.set(data.index, prefixed);
			while (pendingChunks.has(nextChunkToEnqueue)) {
				const chunk = pendingChunks.get(nextChunkToEnqueue)!;
				pendingChunks.delete(nextChunkToEnqueue);
				streamController?.enqueue(chunk);
				nextChunkToEnqueue++;
			}
			if (inputEnded && activeCount === 0) {
				resolveAll();
			}
		} else if (data.type === 'error') {
			const error = new Error(data.message);
			rejectAll(new Error(data.message));
			if (streamController) {
				streamController.error(error);
			} else {
				readyReject(error);
			}
		}
	};

	const copyBytes = (bytes: Uint8Array) => {
		const clone = new Uint8Array(bytes.byteLength);
		clone.set(bytes);
		return clone.buffer;
	};

	worker.postMessage(
		{
			type: 'init',
			keyRaw: copyBytes(aesKey),
			baseIv: copyBytes(baseIv),
			threads: WORKER_CONCURRENCY
		},
		[]
	);

	await readyPromise;

	let chunkIndex = 0;
	let bufferedChunks: Uint8Array[] = [];
	let bufferedBytes = 0;

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		start(controller) {
			streamController = controller;
		},
		async transform(chunk) {
			bufferedChunks.push(chunk);
			bufferedBytes += chunk.length;

			while (bufferedBytes >= CHUNK_SIZE) {
				const fullChunk = new Uint8Array(CHUNK_SIZE);
				let offset = 0;
				while (offset < CHUNK_SIZE) {
					const c = bufferedChunks[0];
					const take = Math.min(c.length, CHUNK_SIZE - offset);
					fullChunk.set(c.subarray(0, take), offset);
					if (take === c.length) {
						bufferedChunks.shift();
					} else {
						bufferedChunks[0] = c.subarray(take);
					}
					offset += take;
				}
				bufferedBytes -= CHUNK_SIZE;

				const index = chunkIndex++;
				activeCount++;
				const buffer = fullChunk.buffer;
				worker.postMessage(
					{
						type: 'encrypt',
						index,
						chunk: buffer,
						useCompression
					},
					[buffer]
				);

				processedTotal += CHUNK_SIZE;
				if (onProgress) onProgress(processedTotal, originalSize);
			}
		},
		async flush() {
			if (bufferedBytes > 0) {
				const remaining = new Uint8Array(bufferedBytes);
				let offset = 0;
				for (const c of bufferedChunks) {
					remaining.set(c, offset);
					offset += c.length;
				}
				const index = chunkIndex++;
				activeCount++;
				const buffer = remaining.buffer;
				worker.postMessage(
					{
						type: 'encrypt',
						index,
						chunk: buffer,
						useCompression
					},
					[buffer]
				);

				processedTotal += bufferedBytes;
				if (onProgress) onProgress(processedTotal, originalSize);
			} else if (chunkIndex === 0) {
				const empty = new Uint8Array(0);
				activeCount++;
				worker.postMessage(
					{
						type: 'encrypt',
						index: 0,
						chunk: empty.buffer,
						useCompression
					},
					[empty.buffer]
				);
			}

			inputEnded = true;
			if (activeCount > 0) {
				await allDonePromise;
			}
			worker.terminate();
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
	password?: string,
	originalSize?: number,
	onProgress?: (processed: number, total?: number) => void,
	useCompression = true
) {
	const ikm = base64urlToBytes(keySecret);
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);

	const worker = new WasmPipelineWorker();
	let readyResolve: () => void;
	let readyReject: (reason?: any) => void;
	const readyPromise = new Promise<void>((resolve, reject) => {
		readyResolve = resolve;
		readyReject = reject;
	});

	const pendingChunks = new Map<number, Uint8Array>();
	let nextChunkToEnqueue = 0;
	let processedTotal = 0;
	let resolveAll: () => void;
	let rejectAll: (e: any) => void;
	const allDonePromise = new Promise<void>((res, rej) => {
		resolveAll = res;
		rejectAll = rej;
	});
	let activeCount = 0;
	let inputEnded = false;
	let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

	worker.onmessage = (ev) => {
		const data = ev.data;
		if (data.type === 'ready') {
			readyResolve();
		} else if (data.type === 'decrypted') {
			activeCount--;
			pendingChunks.set(data.index, new Uint8Array(data.data));
			while (pendingChunks.has(nextChunkToEnqueue)) {
				const chunk = pendingChunks.get(nextChunkToEnqueue)!;
				pendingChunks.delete(nextChunkToEnqueue);
				streamController?.enqueue(chunk);
				nextChunkToEnqueue++;
				processedTotal += chunk.length;
				if (onProgress) onProgress(processedTotal, originalSize);
			}
			if (inputEnded && activeCount === 0) {
				resolveAll();
			}
		} else if (data.type === 'error') {
			const error = new Error(data.message);
			rejectAll(new Error(data.message));
			if (streamController) {
				streamController.error(error);
			} else {
				readyReject(error);
			}
		}
	};

	const copyBytes = (bytes: Uint8Array) => {
		const clone = new Uint8Array(bytes.byteLength);
		clone.set(bytes);
		return clone.buffer;
	};

	worker.postMessage(
		{
			type: 'init',
			keyRaw: copyBytes(aesKey),
			baseIv: copyBytes(baseIv),
			threads: WORKER_CONCURRENCY
		},
		[]
	);

	await readyPromise;

	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);
	let chunkIndex = 0;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			streamController = controller;
		},
		async pull(controller) {
			while (true) {
				if (buffer.length < 4) {
					const { done, value } = await reader.read();
					if (done) {
						if (activeCount === 0 && buffer.length === 0) {
							controller.close();
						}
						inputEnded = true;
						return;
					}
					const newBuf = new Uint8Array(buffer.length + value.length);
					newBuf.set(buffer);
					newBuf.set(value, buffer.length);
					buffer = newBuf;
					continue;
				}

				const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
				const chunkLen = view.getUint32(0, false);

				if (buffer.length < 4 + chunkLen) {
					const { done, value } = await reader.read();
					if (done) {
						controller.error(new Error('Unexpected end of stream'));
						return;
					}
					const newBuf = new Uint8Array(buffer.length + value.length);
					newBuf.set(buffer);
					newBuf.set(value, buffer.length);
					buffer = newBuf;
					continue;
				}

				const chunkData = buffer.slice(4, 4 + chunkLen);
				buffer = buffer.slice(4 + chunkLen);

				const index = chunkIndex++;
				activeCount++;
				const transfer = chunkData.buffer.slice(
					chunkData.byteOffset,
					chunkData.byteOffset + chunkData.byteLength
				);
				worker.postMessage(
					{
						type: 'decrypt',
						index,
						chunk: transfer,
						useCompression
					},
					[transfer]
				);

				return;
			}
		},
		cancel() {
			worker.terminate();
			reader.cancel();
		}
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
