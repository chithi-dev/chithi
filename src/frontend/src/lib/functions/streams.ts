import {
	deriveAESKeyFromIKM,
	getChunkIv,
	bytesToBase64,
	base64url,
	xorBytes,
	pbkdf2Derive,
	type EncryptionMeta,
	CHUNK_SIZE,
	base64ToBytes,
	base64urlToBytes
} from './encryption';
import { createTarHeader } from './tar';

export function createTarStream(files: File[]): ReadableStream<Uint8Array> {
	let fileIndex = 0;
	let currentFileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	let fileBytesRead = 0;
	let finishedStream = false;

	return new ReadableStream({
		async pull(controller) {
			if (finishedStream) {
				controller.close();
				return;
			}

			if (!currentFileReader) {
				if (fileIndex >= files.length) {
					// End of files, write two empty blocks
					const endBlock = new Uint8Array(1024);
					controller.enqueue(endBlock);
					finishedStream = true;
					controller.close();
					return;
				}

				const file = files[fileIndex];
				// Write header
				const header = createTarHeader(file);
				controller.enqueue(header);

				currentFileReader = file.stream().getReader();
				fileBytesRead = 0;
			}

			// Read from current file
			const { done, value } = await currentFileReader!.read();
			if (done) {
				// File finished
				// Write padding
				if (fileBytesRead % 512 !== 0) {
					const padding = new Uint8Array(512 - (fileBytesRead % 512));
					controller.enqueue(padding);
				}
				currentFileReader = null;
				fileIndex++;
				// Loop will continue on next pull
			} else {
				fileBytesRead += value.byteLength;
				controller.enqueue(value);
			}
		}
	});
}

export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string
) {
	// 1. Generate Secrets
	const ikm = crypto.getRandomValues(new Uint8Array(32));
	const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
	const baseIv = crypto.getRandomValues(new Uint8Array(12));

	let finalIKM = ikm;
	const meta: EncryptionMeta = {
		cipher: 'AES-GCM',
		hkdf: { hash: 'SHA-512', salt: bytesToBase64(hkdfSalt) },
		iv: bytesToBase64(baseIv)
	};

	if (password && password.length > 0) {
		const iterations = 150_000;
		const pbkdf2Salt = crypto.getRandomValues(new Uint8Array(16));
		const pb = await pbkdf2Derive(password, pbkdf2Salt, iterations, 32);
		finalIKM = xorBytes(ikm, pb);
		meta.pbkdf2 = { salt: bytesToBase64(pbkdf2Salt), iterations };
	}

	// 2. Derive AES Key
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	// 3. Create Transformer
	let buffer = new Uint8Array(0);
	let chunkIndex = 0;

	const transformer = new TransformStream<Uint8Array, Uint8Array>({
		async start(controller) {
			// Prepare header
			const metaJson = JSON.stringify(meta);
			const metaBytes = new TextEncoder().encode(metaJson);
			const metaLen = new Uint8Array(4);
			new DataView(metaLen.buffer).setUint32(0, metaBytes.length, false); // Big endian
			controller.enqueue(metaLen);
			controller.enqueue(metaBytes);
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
		keySecret: base64url(ikm),
		meta
	};
}

export async function createDecryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	keySecret: string,
	password?: string
): Promise<ReadableStream<Uint8Array>> {
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

	// Read Meta Length
	const lenBytes = await readBytes(4);
	const metaLen = new DataView(lenBytes.buffer).getUint32(0, false);

	// Read Meta
	const metaBytes = await readBytes(metaLen);
	const metaJson = new TextDecoder().decode(metaBytes);
	const meta = JSON.parse(metaJson) as EncryptionMeta;

	// Derive Keys
	const ikm = base64urlToBytes(keySecret);
	let finalIKM = ikm;

	if (meta.pbkdf2) {
		if (!password) {
			throw new Error('Password required for decryption');
		}
		const pbkdf2Salt = base64ToBytes(meta.pbkdf2.salt);
		const pb = await pbkdf2Derive(password, pbkdf2Salt, meta.pbkdf2.iterations, 32);
		finalIKM = xorBytes(ikm, pb);
	}

	const hkdfSalt = base64ToBytes(meta.hkdf.salt);
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);
	const baseIv = base64ToBytes(meta.iv);

	// Create Stream
	const TAG_LEN = 16;
	const ENC_CHUNK_SIZE = CHUNK_SIZE + TAG_LEN;
	let chunkIndex = 0;

	return new ReadableStream({
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
