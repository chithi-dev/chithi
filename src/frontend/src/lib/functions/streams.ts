import { zip } from 'fflate';
import {
	HEADER_LENGTH,
	RECORD_SIZE,
	RECORD_SIZE_FIELD_LENGTH,
	SALT_LENGTH,
} from '#consts/encryption';
import { base64url, base64urlToBytes, resolveIkM } from './encryption';
import CryptoWorker from '#workers/crypto.worker?worker';

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Name deduplication for multi-file zips (kept from prior implementation).
// ---------------------------------------------------------------------------
const usedNames = new Map<string, number>();
const makeUnique = (name: string) => {
	const count = usedNames.get(name) ?? 0;
	usedNames.set(name, count + 1);
	if (!count) return name;
	const dot = name.lastIndexOf('.');
	return dot > 0 ? `${name.slice(0, dot)}_${count}${name.slice(dot)}` : `${name}_${count}`;
};

// ---------------------------------------------------------------------------
// Zip: read all files into memory and produce a single ReadableStream of the
// compressed zip bytes. (fflate is synchronous; we wrap the result.)
// ---------------------------------------------------------------------------
export async function createZipStream(files: File[]): Promise<ReadableStream<Uint8Array>> {
	const entries: Record<string, Uint8Array> = {};
	for (const file of files) {
		entries[makeUnique(file.name)] = new Uint8Array(await file.arrayBuffer());
	}

	return new Promise((resolve, reject) => {
		zip(entries, { level: 6 }, (error: Error | null, data: Uint8Array | undefined) => {
			if (error || !data) {
				reject(error ?? new Error('zip produced no data'));
				return;
			}
			resolve(
				new ReadableStream({
					start(controller) {
						controller.enqueue(data);
						controller.close();
					},
				}),
			);
		});
	});
}

// ECE (RFC 8188) streaming encrypt/decrypt over AES-128-GCM.
//
// Wire format:
//   [16-byte random salt][4-byte record size, BE]
//   [record_0][record_1]...
//
// Each record is the AES-128-GCM ciphertext of a RECORD_SIZE-sized plaintext
// chunk (last record may be shorter). Per-record nonce = random 12-byte
// nonceBase XOR sequence_number (last 4 bytes BE).
//
// The file key is HKDF-derived from the IKM + salt. The IKM (or password)
// travels in the URL hash fragment; the salt travels in the ciphertext header.
// ---------------------------------------------------------------------------

interface WorkerSlot {
	worker: Worker;
	ready: Promise<void>;
}

function makeWorkerSlot(ikmB64: string, passwordB64: string | null, op: 'encrypt' | 'decrypt'): WorkerSlot {
	const worker = new CryptoWorker();
	let resolveReady: () => void;
	let rejectReady: (e: Error) => void;
	const ready = new Promise<void>((res, rej) => {
		resolveReady = res;
		rejectReady = rej;
	});
	worker.onmessage = (e: MessageEvent) => {
		const msg = e.data;
		if (msg.type === 'ready') resolveReady();
		else if (msg.type === 'error') rejectReady(new Error(msg.error ?? 'worker error'));
	};
	worker.onerror = (e) => rejectReady(new Error(e.message || 'worker error'));
	worker.postMessage({ type: 'init', ikmB64, passwordB64, op });
	return { worker, ready };
}

async function workerProcess(slot: WorkerSlot, index: number, data: Uint8Array): Promise<Uint8Array> {
	await slot.ready;
	const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
	return await new Promise<Uint8Array>((resolve, reject) => {
		const handler = (e: MessageEvent) => {
			const msg = e.data;
			if (msg.type === 'chunk' && msg.index === index) {
				slot.worker.removeEventListener('message', handler);
				resolve(new Uint8Array(msg.data as ArrayBuffer));
			} else if (msg.type === 'error') {
				slot.worker.removeEventListener('message', handler);
				reject(new Error(msg.error ?? 'worker error'));
			}
		};
		slot.worker.addEventListener('message', handler);
		slot.worker.postMessage({ type: 'chunk', index, data: buf }, [buf]);
	});
}

// ---------------------------------------------------------------------------
// createEncryptedStream
//
// Reads the input stream, slices into RECORD_SIZE chunks, encrypts each in a
// worker, and emits the ECE header + ciphertext records in order. Returns the
// encrypted stream and the base64url-encoded IKM (the "keySecret" embedded in
// the share URL hash).
// ---------------------------------------------------------------------------
export async function createEncryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	password?: string,
	origSize?: number,
	onProgress?: (processed: number, total?: number) => void,
	ikmOverride?: Uint8Array,
): Promise<{ stream: ReadableStream<Uint8Array>; keySecret: string }> {
	const ikm = await resolveIkM(ikmOverride ?? null, password ?? null);
	const keySecret = base64url(ikm);
	const ikmB64 = keySecret;
	const passwordB64 = password ? base64url(encoder.encode(password)) : null;

	const slot = makeWorkerSlot(ikmB64, passwordB64, 'encrypt');

	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const header = new Uint8Array(HEADER_LENGTH);
	header.set(salt, 0);
	const view = new DataView(header.buffer, SALT_LENGTH, RECORD_SIZE_FIELD_LENGTH);
	view.setUint32(0, RECORD_SIZE);

	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);
	let processed = 0;
	let seq = 0;
	let inputDone = false;
	let headerEmitted = false;

	const readMore = async (): Promise<Uint8Array | null> => {
		const { done, value } = await reader.read();
		if (done) return null;
		return value;
	};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			// Emit the ECE header first so the decryptor knows the record size.
			controller.enqueue(header);
			headerEmitted = true;
		},
		async pull(controller) {
			for (;;) {
				// Fill the buffer until we have at least RECORD_SIZE bytes, or
				// the input is exhausted (then whatever remains is the final
				// partial record).
				if (buffer.length < RECORD_SIZE) {
					const value = await readMore();
					if (value === null) {
						inputDone = true;
						if (buffer.length === 0) {
							slot.worker.terminate();
							controller.close();
							return;
						}
					} else {
						const combined = new Uint8Array(buffer.length + value.length);
						combined.set(buffer);
						combined.set(value, buffer.length);
						buffer = combined;
					}
				}

				// Slice off the next record (full RECORD_SIZE, or the final
				// partial if the input is done).
				const isFinal = inputDone;
				const chunkSize = isFinal ? buffer.length : RECORD_SIZE;
				const chunk = buffer.slice(0, chunkSize);
				buffer = buffer.slice(chunkSize);

				// Encrypt this record in the worker and emit the ciphertext.
				const index = seq++;
				const ciphertext = await workerProcess(slot, index, chunk);
				processed += chunkSize;
				onProgress?.(processed, origSize);
				controller.enqueue(ciphertext);

				// If the input is exhausted and the buffer is empty, we're done.
				if (isFinal && buffer.length === 0) {
					slot.worker.terminate();
					controller.close();
					return;
				}
			}
		},
		cancel() {
			slot.worker.terminate();
			reader.cancel().catch(() => {});
		},
	});

	return { stream, keySecret };
}

// ---------------------------------------------------------------------------
// createDecryptedStream
//
// Reads the ECE wire format, strips the header, and decrypts each record in a
// worker. Emits plaintext chunks in order.
// ---------------------------------------------------------------------------
export async function createDecryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	keySecret: string,
	password?: string,
	origSize?: number,
	onProgress?: (processed: number, total?: number) => void,
): Promise<ReadableStream<Uint8Array>> {
	const ikm = password ? await resolveIkM(null, password) : base64urlToBytes(keySecret);
	const ikmB64 = base64url(ikm);
	const passwordB64 = password ? base64url(encoder.encode(password)) : null;

	const slot = makeWorkerSlot(ikmB64, passwordB64, 'decrypt');
	const reader = inputStream.getReader();

	let headerConsumed = false;
	let buffer = new Uint8Array(0);
	let seq = 0;
	let processed = 0;
	let inputDone = false;

	const readMore = async (): Promise<Uint8Array | null> => {
		const { done, value } = await reader.read();
		if (done) return null;
		return value;
	};

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			for (;;) {
				// 1) Consume the ECE header exactly once (salt + record size).
				if (!headerConsumed) {
					while (buffer.length < HEADER_LENGTH) {
						const value = await readMore();
						if (value === null) throw new Error('Ciphertext ended before header');
						const combined = new Uint8Array(buffer.length + value.length);
						combined.set(buffer);
						combined.set(value, buffer.length);
						buffer = combined;
					}
					buffer = buffer.slice(HEADER_LENGTH);
					headerConsumed = true;
				}

				// 2) Fill the buffer until we have at least RECORD_SIZE bytes, or
				//    the input is exhausted (then whatever remains is the final
				//    partial record).
				if (buffer.length < RECORD_SIZE) {
					const value = await readMore();
					if (value === null) {
						inputDone = true;
						if (buffer.length === 0) {
							slot.worker.terminate();
							controller.close();
							return;
						}
					} else {
						const combined = new Uint8Array(buffer.length + value.length);
						combined.set(buffer);
						combined.set(value, buffer.length);
						buffer = combined;
					}
				}

				// 3) Slice off the next ciphertext record (full RECORD_SIZE, or
				//    the final partial if the input is done).
				const isFinal = inputDone;
				const chunkSize = isFinal ? buffer.length : RECORD_SIZE;
				const chunk = buffer.slice(0, chunkSize);
				buffer = buffer.slice(chunkSize);

				// 4) Decrypt this record in the worker and emit the plaintext.
				const index = seq++;
				const plaintext = await workerProcess(slot, index, chunk);
				processed += plaintext.byteLength;
				onProgress?.(processed, origSize);
				controller.enqueue(plaintext);

				// 5) If the input is exhausted and the buffer is empty, we're done.
				if (isFinal && buffer.length === 0) {
					slot.worker.terminate();
					controller.close();
					return;
				}
			}
		},
		cancel() {
			slot.worker.terminate();
			reader.cancel().catch(() => {});
		},
	});

	return stream;
}

// ---------------------------------------------------------------------------
// Multipart stream builder (unchanged from prior implementation).
// ---------------------------------------------------------------------------
export function createMultipartStream(
	boundary: string,
	fields: Record<string, string>,
	fileField: string,
	filename: string,
	fileStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
	const parts: Uint8Array[] = [];
	for (const [k, v] of Object.entries(fields)) {
		parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
	}
	parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
	const post = encoder.encode(`\r\n--${boundary}--\r\n`);

	let phase: 0 | 1 | 2 | 3 = 0;
	let pi = 0;
	let fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

	return new ReadableStream({
		async pull(controller) {
			for (;;) {
				if (phase === 0) {
					if (pi < parts.length) {
						controller.enqueue(parts[pi++]!);
						return;
					}
					phase = 1;
					fileReader = fileStream.getReader();
					continue;
				}
				if (phase === 1) {
					const { done, value } = await fileReader!.read();
					if (done) {
						phase = 2;
						continue;
					}
					controller.enqueue(value);
					return;
				}
				if (phase === 2) {
					controller.enqueue(post);
					phase = 3;
					return;
				}
				controller.close();
				return;
			}
		},
		cancel() {
			fileReader?.cancel() ?? fileStream.cancel();
		},
	});
}
