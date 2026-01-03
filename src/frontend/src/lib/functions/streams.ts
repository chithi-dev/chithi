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
import ArchiveWorker from '../workers/archive.worker?worker';

export function create7zStream(files: File[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			const worker = new ArchiveWorker();
			worker.onmessage = (e) => {
				const { type, data, error } = e.data;
				if (type === 'complete') {
					controller.enqueue(data);
					controller.close();
					worker.terminate();
				} else {
					controller.error(new Error(error));
					worker.terminate();
				}
			};
			worker.onerror = (e) => {
				console.error('Worker error event:', e);
				// ErrorEvent.message is often "Script error." for cross-origin scripts or generic errors
				// We try to get more info if possible, but often it's limited in workers
				const errorMessage = e.message || 'Unknown worker error (check console)';
				controller.error(new Error(errorMessage));
				worker.terminate();
			};
			worker.postMessage({ files: [...files] });
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
					// If we overflow 1000 bytes, we just write what fits?
					// Or we should have made the header dynamic?
					// For now, assume it fits (metadata is small).
					// If it doesn't fit, we truncate, which is bad, but better than crashing.
					const remaining = 1000 - offset;
					if (remaining > 0) {
						header.set(part.slice(0, remaining), offset);
						offset += remaining;
					}
				}
			}

			controller.enqueue(header);
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

				const chunkIv = getChunkIv(baseIv, chunkIndex);
				const encrypted = await crypto.subtle.encrypt(
					{ name: 'AES-GCM', iv: chunkIv as any },
					aesKey,
					chunkData
				);
				controller.enqueue(new Uint8Array(encrypted));
				chunkIndex++;
			}
		},
		async flush(controller) {
			// Process remaining buffer
			if (buffer.length > 0 || chunkIndex === 0) {
				const chunkIv = getChunkIv(baseIv, chunkIndex);
				const encrypted = await crypto.subtle.encrypt(
					{ name: 'AES-GCM', iv: chunkIv as any },
					aesKey,
					buffer
				);
				controller.enqueue(new Uint8Array(encrypted));
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

	// Create Stream
	const TAG_LEN = 16;
	const ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN;
	let chunkIndex = 0;

	const stream = new ReadableStream({
		async pull(controller) {
			// We need to read ENC_CHUNK_SIZE from the reader+buffer
			// But the last chunk might be smaller.

			while (buffer.length < ENC_CHUNK_SIZE) {
				const { done, value } = await reader.read();
				if (done) break;
				const newBuf = new Uint8Array(buffer.length + value.length);
				newBuf.set(buffer);
				newBuf.set(value, buffer.length);
				buffer = newBuf;
			}

			if (buffer.length === 0) {
				controller.close();
				return;
			}

			let currentChunkSize = ENC_CHUNK_SIZE;
			if (buffer.length < ENC_CHUNK_SIZE) {
				// End of stream
				currentChunkSize = buffer.length;
			}

			const chunkData = buffer.slice(0, currentChunkSize);
			buffer = buffer.slice(currentChunkSize);

			const chunkIv = getChunkIv(baseIv, chunkIndex);
			try {
				const decrypted = await crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv: chunkIv as any },
					aesKey,
					chunkData
				);
				controller.enqueue(new Uint8Array(decrypted));
				chunkIndex++;
			} catch (e) {
				controller.error(e);
			}
		}
	});

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
