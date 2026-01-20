import {
	deriveAESKeyFromIKM,
	getChunkIv,
	bytesToBase64,
	base64url,
	xorBytes,
	argon2Derive,
	type InnerEncryptionMeta,
	CHUNK_SIZE,
	base64ToBytes,
	base64urlToBytes
} from './encryption';
import {
	createLocalFileHeader,
	createDataDescriptor,
	createCentralDirectoryHeader,
	createEndOfCentralDirectory,
	crc32,
	type ZipFileEntry
} from './zip';

export function createZipStream(files: File[]): ReadableStream<Uint8Array> {
	let fileIndex = 0;
	let currentFileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let fileBytesRead = 0;
	let fileUncompressedSize = 0;
	let fileCrc = 0;
	let currentFileOffset = 0;
	let totalOffset = 0;
	let finishedStream = false;
	let state: 'header' | 'content' | 'descriptor' | 'cd' | 'eocd' | 'done' = 'header';

	const entries: ZipFileEntry[] = [];
	let cdIndex = 0;
	let cdStartOffset = 0;

	// Check for Deflate Raw support
	let supportsDeflateRaw = false;
	let supportsDeflate = false;
	try {
		new CompressionStream('deflate-raw');
		supportsDeflateRaw = true;
	} catch (e) {
		try {
			new CompressionStream('deflate');
			supportsDeflate = true;
		} catch (e2) {
			// Ignore
		}
	}

	return new ReadableStream({
		async pull(controller) {
			while (true) {
				if (finishedStream) {
					controller.close();
					return;
				}

				if (state === 'header') {
					if (fileIndex >= files.length) {
						state = 'cd';
						cdStartOffset = totalOffset;
						continue;
					}

					const file = files[fileIndex];
					const name = ((file as any).relativePath as string) || file.name;
					const lastModified = new Date(file.lastModified);

					let compressionMethod = 0;
					let stream = file.stream();

					// CRC and Size tracking transformer
					const crcTransformer = new TransformStream({
						transform(chunk, controller) {
							fileCrc = crc32(chunk, fileCrc);
							fileUncompressedSize += chunk.byteLength;
							controller.enqueue(chunk);
						}
					});

					stream = stream.pipeThrough(crcTransformer);

					if (supportsDeflateRaw) {
						compressionMethod = 8;
						stream = stream.pipeThrough(new CompressionStream('deflate-raw'));
					} else if (supportsDeflate) {
						compressionMethod = 8;
						stream = stream.pipeThrough(new CompressionStream('deflate'));
						stream = stream.pipeThrough(createDeflateStripper() as any);
					}

					const header = createLocalFileHeader(name, 0, lastModified, compressionMethod);

					// Record entry start
					currentFileOffset = totalOffset;

					controller.enqueue(header);
					totalOffset += header.length;

					currentFileReader = stream.getReader();
					fileBytesRead = 0;
					fileUncompressedSize = 0;
					fileCrc = 0;
					state = 'content';
					return; // Yield
				}

				if (state === 'content') {
					const { done, value } = await currentFileReader!.read();
					if (done) {
						state = 'descriptor';
						continue;
					}

					fileBytesRead += value.byteLength;
					controller.enqueue(value);
					totalOffset += value.byteLength;
					return; // Yield
				}

				if (state === 'descriptor') {
					const descriptor = createDataDescriptor(fileCrc, fileBytesRead, fileUncompressedSize);
					controller.enqueue(descriptor);
					totalOffset += descriptor.length;

					const file = files[fileIndex];
					const name = ((file as any).relativePath as string) || file.name;

					entries.push({
						name,
						compressedSize: fileBytesRead,
						uncompressedSize: fileUncompressedSize,
						crc: fileCrc,
						offset: currentFileOffset,
						lastModified: new Date(file.lastModified),
						compressionMethod: supportsDeflateRaw || supportsDeflate ? 8 : 0
					});

					fileIndex++;
					currentFileReader = null;
					state = 'header';
					return; // Yield
				}

				if (state === 'cd') {
					if (cdIndex >= entries.length) {
						state = 'eocd';
						continue;
					}

					const entry = entries[cdIndex];
					const header = createCentralDirectoryHeader(entry);
					controller.enqueue(header);
					totalOffset += header.length;
					cdIndex++;
					return; // Yield
				}

				if (state === 'eocd') {
					const cdSize = totalOffset - cdStartOffset;
					const eocd = createEndOfCentralDirectory(entries.length, cdSize, cdStartOffset);
					controller.enqueue(eocd);
					finishedStream = true;
					return; // Yield
				}
			}
		}
	});
}

function createDeflateStripper() {
	let buffer = new Uint8Array(0);
	let headerRemoved = false;

	return new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			let data = chunk;

			if (!headerRemoved) {
				const newBuf = new Uint8Array(buffer.length + data.length);
				newBuf.set(buffer);
				newBuf.set(data, buffer.length);
				buffer = newBuf;

				if (buffer.length >= 2) {
					// Strip header (2 bytes)
					data = buffer.slice(2);
					headerRemoved = true;
					buffer = new Uint8Array(0);
					// Continue to process data
				} else {
					// Wait for more data
					return;
				}
			}

			// Footer handling: keep last 4 bytes
			const newBuf = new Uint8Array(buffer.length + data.length);
			newBuf.set(buffer);
			newBuf.set(data, buffer.length);
			buffer = newBuf;

			if (buffer.length > 4) {
				const toEmit = buffer.slice(0, buffer.length - 4);
				controller.enqueue(toEmit);
				buffer = buffer.slice(buffer.length - 4);
			}
		},
		flush(controller) {
			// Discard buffer (Adler-32)
		}
	});
}

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	originalSize?: number
) {
	// 1. Generate Secrets
	const ikm = crypto.getRandomValues(new Uint8Array(32));
	const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
	const baseIv = crypto.getRandomValues(new Uint8Array(12));

	// Metadata encryption secrets
	const metaSalt = crypto.getRandomValues(new Uint8Array(16));
	const metaIv = crypto.getRandomValues(new Uint8Array(12));

	let finalIKM = ikm;
	let argon2Meta:
		| { salt: Uint8Array; iterations: number; memory: number; parallelism: number }
		| undefined;

	if (password && password.length > 0) {
		const iterations = 32;
		const memory = 16384;
		const parallelism = 1;
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const pb = await argon2Derive(password, salt, iterations, memory, 32, parallelism);
		finalIKM = xorBytes(ikm, pb);
		argon2Meta = { salt, iterations, memory, parallelism };
	}

	// 2. Encrypt Metadata
	const metaKey = await deriveAESKeyFromIKM(finalIKM, metaSalt);
	const innerMeta: InnerEncryptionMeta = {
		cipher: 'AES-GCM',
		hkdf: { hash: 'SHA-512', salt: bytesToBase64(hkdfSalt) },
		iv: bytesToBase64(baseIv),
		size: originalSize
	};
	const innerMetaJson = JSON.stringify(innerMeta);
	const innerMetaBytes = new TextEncoder().encode(innerMetaJson);
	const encryptedMetaBytes = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: metaIv },
		metaKey,
		innerMetaBytes
	);

	// 3. Derive AES Key for Content
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	// 4. Create Transformer
	let buffer = new Uint8Array(0);
	let chunkIndex = 0;

	// Worker-pool shared state (moved to outer scope so transform/flush can access)
	let workers: Worker[] = [];
	let nextWorker = 0;
	const encryptedMap = new Map<number, Uint8Array>();
	let nextToEnqueue = 0;
	let pendingCount = 0;
	let allDonePromise: Promise<void> | null = null;
	let allDoneResolve: (() => void) | null = null;
	let allDoneReject: ((e: any) => void) | null = null;
	let streamEnded = false;
	let assignChunk: ((index: number, chunkData: Uint8Array) => void) | null = null;

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		async start(controller) {
			// Prepare header
			// Layout: [Flags: 1] [MetaSalt: 16] [MetaIV: 12] ([PBKDF2Salt: 16] [PBKDF2Iter: 4])? [EncLen: 4] [EncData: N] [Padding...]
			const headerParts: Uint8Array[] = [];

			// Flags
			const flags = argon2Meta ? 1 : 0;
			headerParts.push(new Uint8Array([flags]));

			// Meta Salt
			headerParts.push(metaSalt);

			// Meta IV
			headerParts.push(metaIv);

			// Argon2
			if (argon2Meta) {
				headerParts.push(argon2Meta.salt);
				const params = new Uint8Array(12);
				const view = new DataView(params.buffer);
				view.setUint32(0, argon2Meta.iterations, false);
				view.setUint32(4, argon2Meta.memory, false);
				view.setUint32(8, argon2Meta.parallelism, false);
				headerParts.push(params);
			}

			// Encrypted Meta Length
			const lenBytes = new Uint8Array(4);
			new DataView(lenBytes.buffer).setUint32(0, encryptedMetaBytes.byteLength, false);
			headerParts.push(lenBytes);

			// Encrypted Meta
			headerParts.push(new Uint8Array(encryptedMetaBytes));

			// Calculate total length so far
			const currentLen = headerParts.reduce((acc, part) => acc + part.length, 0);

			// Padding
			const paddingLen = Math.max(0, 1000 - currentLen);
			headerParts.push(new Uint8Array(paddingLen));

			// Combine
			const header = new Uint8Array(1000);
			let offset = 0;
			for (const part of headerParts) {
				if (offset + part.length <= 1000) {
					header.set(part, offset);
					offset += part.length;
				} else {
					const remaining = 1000 - offset;
					if (remaining > 0) {
						header.set(part.slice(0, remaining), offset);
						offset += remaining;
					}
				}
			}

			controller.enqueue(header);

			// Setup worker pool for parallel encryption (if supported)
			const concurrency = Math.max(1, (navigator && (navigator as any).hardwareConcurrency) || 4);
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
					// Enqueue in-order
					while (encryptedMap.has(nextToEnqueue)) {
						const arr = encryptedMap.get(nextToEnqueue)!;
						encryptedMap.delete(nextToEnqueue);
						controller.enqueue(arr);
						nextToEnqueue++;
					}

					if (streamEnded && pendingCount === 0) {
						if (allDoneResolve) allDoneResolve();
					}
				} else if (data?.type === 'error') {
					if (allDoneReject) allDoneReject(new Error(data.message || 'Worker error'));
				}
			};

			// Initialize workers
			try {
				const keyRaw = await crypto.subtle.exportKey('raw', aesKey);

				for (let i = 0; i < concurrency; i++) {
					const w = new Worker(new URL('../workers/encrypt.worker.ts', import.meta.url), {
						type: 'module'
					});
					w.onmessage = (ev) => handleWorkerMessage(ev.data);
					workers.push(w);
					// Initialize worker with copies of key and baseIv (transferable). Use slice to avoid neutering the main copy.
					const keyCopy = keyRaw.slice(0);
					const ivCopy = baseIv.buffer.slice(0);
					w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
				}
			} catch (e) {
				// If worker initialization fails or Workers aren't supported, fall back to single-threaded crypto
				workers.length = 0; // indicate no workers
			}

			// Helpers to assign chunk to worker (if available) or process inline
			assignChunk = async (index: number, chunkData: Uint8Array) => {
				pendingCount++;
				if (workers.length > 0) {
					// Transfer a tightly-packed ArrayBuffer
					const transferable = chunkData.buffer.slice(
						chunkData.byteOffset,
						chunkData.byteOffset + chunkData.byteLength
					);
					const w = workers[nextWorker];
					nextWorker = (nextWorker + 1) % workers.length;
					w.postMessage({ type: 'encrypt', index, chunk: transferable }, [transferable]);
				} else {
					// Inline fallback
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
						}
						if (streamEnded && pendingCount === 0) {
							if (allDoneResolve) allDoneResolve();
						}
					} catch (err) {
						if (allDoneReject) allDoneReject(err);
					}
				}
			};
		},
		async transform(chunk, controller) {
			// Append to buffer
			const newBuffer = new Uint8Array(buffer.length + chunk.length);
			newBuffer.set(buffer);
			newBuffer.set(chunk, buffer.length);
			buffer = newBuffer;

			// Process full chunks
			while (buffer.length >= CHUNK_SIZE) {
				const chunkData = buffer.slice(0, CHUNK_SIZE);
				buffer = buffer.slice(CHUNK_SIZE);

				const index = chunkIndex;
				chunkIndex++;
				// Assign chunk for encryption (async)
				if (assignChunk) assignChunk(index, chunkData);
			}
		},
		async flush(controller) {
			// Process remaining buffer (may be zero-length if no data)
			if (buffer.length > 0 || chunkIndex === 0) {
				const chunkData = buffer.slice(0);
				const index = chunkIndex;
				chunkIndex++;
				if (assignChunk) assignChunk(index, chunkData);
			}

			// Wait for all pending chunks to finish
			streamEnded = true;
			if (pendingCount > 0) {
				try {
					await allDonePromise;
				} catch (e) {
					throw e;
				}
			}

			// Clean up workers
			try {
				for (const w of workers) {
					w.terminate();
				}
			} catch (e) {
				// ignore
			}
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
): Promise<{ stream: ReadableStream<Uint8Array>; meta: InnerEncryptionMeta }> {
	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);

	// Helper to read N bytes
	async function readBytes(n: number): Promise<Uint8Array> {
		while (buffer.length < n) {
			const { done, value } = await reader.read();
			if (done) break;
			const newBuf = new Uint8Array(buffer.length + value.length);
			newBuf.set(buffer);
			newBuf.set(value, buffer.length);
			buffer = newBuf;
		}
		if (buffer.length < n) throw new Error('Unexpected end of stream');
		const res = buffer.slice(0, n);
		buffer = buffer.slice(n);
		return res;
	}

	// Read fixed 1000 byte header
	const headerBytes = await readBytes(1000);
	let offset = 0;
	const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);

	const flags = view.getUint8(offset);
	offset += 1;

	const metaSalt = headerBytes.slice(offset, offset + 16);
	offset += 16;

	const metaIv = headerBytes.slice(offset, offset + 12);
	offset += 12;

	let argon2Salt: Uint8Array | undefined;
	let argon2Iterations: number | undefined;
	let argon2Memory: number | undefined;
	let argon2Parallelism: number | undefined;

	if (flags & 1) {
		argon2Salt = headerBytes.slice(offset, offset + 16);
		offset += 16;

		argon2Iterations = view.getUint32(offset, false);
		offset += 4;

		argon2Memory = view.getUint32(offset, false);
		offset += 4;

		argon2Parallelism = view.getUint32(offset, false);
		offset += 4;
	}

	const encMetaLen = view.getUint32(offset, false);
	offset += 4;

	const encryptedMetaBytes = headerBytes.slice(offset, offset + encMetaLen);

	// Derive Keys
	const ikm = base64urlToBytes(keySecret);
	let finalIKM = ikm;

	if (argon2Salt && argon2Iterations && argon2Memory && argon2Parallelism) {
		if (!password) {
			throw new Error('Password required for decryption');
		}
		const pb = await argon2Derive(
			password,
			argon2Salt,
			argon2Iterations,
			argon2Memory,
			32,
			argon2Parallelism
		);
		finalIKM = xorBytes(ikm, pb);
	}

	// Decrypt Metadata
	const metaKey = await deriveAESKeyFromIKM(finalIKM, metaSalt);

	let innerMeta: InnerEncryptionMeta;
	try {
		const decryptedMetaBytes = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: metaIv },
			metaKey,
			encryptedMetaBytes
		);
		const decryptedMetaJson = new TextDecoder().decode(decryptedMetaBytes);
		innerMeta = JSON.parse(decryptedMetaJson);
	} catch (e) {
		// If decryption fails, it might be wrong password or corrupted data
		throw new Error('Failed to decrypt metadata (wrong password?)');
	}

	const hkdfSalt = base64ToBytes(innerMeta.hkdf.salt);
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);
	const baseIv = base64ToBytes(innerMeta.iv);

	// Create Stream (parallel decrypt using worker pool)
	const TAG_LEN = 16;
	const ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN;
	let chunkIndex = 0;

	// Worker pool state
	const concurrency = Math.max(1, (navigator && (navigator as any).hardwareConcurrency) || 4);
	const workers: Worker[] = [];
	let nextWorker = 0;
	const decryptedMap = new Map<number, Uint8Array>();
	let nextToEnqueue = 0;
	let pendingCount = 0;
	let allDoneResolve: (() => void) | null = null;
	let allDoneReject: ((e: any) => void) | null = null;
	let allDonePromise: Promise<void> | null = null;
	let streamEnded = false;

	const startWorkers = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
		try {
			const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
			for (let i = 0; i < concurrency; i++) {
				const w = new Worker(new URL('../workers/decrypt.worker.ts', import.meta.url), {
					type: 'module'
				});
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
						if (allDoneReject) allDoneReject(new Error(data.message || 'Worker error'));
					}
				};
				workers.push(w);
				const keyCopy = keyRaw.slice(0);
				const ivCopy = baseIv.buffer.slice(0);
				w.postMessage({ type: 'init', keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
			}
		} catch (e) {
			// if workers fail, we'll fall back to inline decryption
			workers.length = 0;
		}
	};

	const assignChunk = (
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
			// inline fallback
			(async () => {
				try {
					const iv = getChunkIv(baseIv, index);
					const buf = chunkBuf.buffer.slice(
						chunkBuf.byteOffset,
						chunkBuf.byteOffset + chunkBuf.byteLength
					) as ArrayBuffer;
					const decrypted = await crypto.subtle.decrypt(
						{ name: 'AES-GCM', iv: iv as any },
						aesKey,
						buf
					);
					pendingCount--;
					decryptedMap.set(index, new Uint8Array(decrypted));
					// If a controller was passed in, flush available chunks immediately
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
					if (allDoneReject) allDoneReject(err);
				}
			})();
		}
	};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			// initialize worker pool only when stream starts
			allDonePromise = new Promise<void>((res, rej) => {
				allDoneResolve = res;
				allDoneReject = rej;
			});
			await startWorkers(controller);
		},
		async pull(controller) {
			// Fill buffer until we have at least ENC_CHUNK_SIZE or EOF
			while (buffer.length < ENC_CHUNK_SIZE) {
				const { done, value } = await reader.read();
				if (done) break;
				const newBuf = new Uint8Array(buffer.length + value.length);
				newBuf.set(buffer);
				newBuf.set(value, buffer.length);
				buffer = newBuf;
			}

			if (buffer.length === 0) {
				// No more data and nothing pending
				if (pendingCount === 0) {
					controller.close();
					return;
				}
				// Wait for pending decryption to finish
				streamEnded = true;
				if (allDonePromise) await allDonePromise;
				controller.close();
				return;
			}

			let currentChunkSize = ENC_CHUNK_SIZE;
			let isLast = false;
			if (buffer.length < ENC_CHUNK_SIZE) {
				// End of stream - last chunk
				currentChunkSize = buffer.length;
				isLast = true;
			}

			const chunkData = buffer.slice(0, currentChunkSize);
			buffer = buffer.slice(currentChunkSize);

			const index = chunkIndex++;
			assignChunk(index, chunkData, controller);

			// If last chunk and no more reads expected, wait until pending are done before closing in next pull
			if (isLast && pendingCount === 0) {
				// Enqueue any ready chunks
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
			// Terminate workers
			for (const w of workers) {
				try {
					w.terminate();
				} catch (e) {
					// ignore
				}
			}
		}
	});

	// Close workers when all done
	if (allDonePromise != null) {
		(allDonePromise as Promise<void>)
			.then(() => {
				for (const w of workers) w.terminate();
			})
			.catch(() => {
				for (const w of workers) w.terminate();
			});
	}

	return { stream, meta: innerMeta };
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
