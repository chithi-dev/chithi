import JS7z from '#vendor/js7z/js7z.js';
import js7zWasmUrl from '#vendor/js7z/js7z.wasm?url';
import type { MainModule } from '#vendor/js7z/js7z.d';
import {
	HEADER_LENGTH,
	RECORD_SIZE,
	RECORD_SIZE_FIELD_LENGTH,
	SALT_LENGTH,
	SCHEME_VERSION,
	VERSION_LENGTH,
} from '#consts/encryption';
import { base64url, base64urlToBytes, resolveIkM } from './encryption';
import CryptoWorker from '#workers/crypto.worker?worker';

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Name deduplication for multi-file archives (kept from prior implementation).
// ---------------------------------------------------------------------------
const usedNames = new Map<string, number>();
const makeUnique = (name: string) => {
	const count = usedNames.get(name) ?? 0;
	usedNames.set(name, count + 1);
	if (!count) return name;
	const dot = name.lastIndexOf('.');
	return dot > 0 ? `${name.slice(0, dot)}_${count}${name.slice(dot)}` : `${name}_${count}`;
};

// The vendored .d.ts omits the runtime lifecycle callbacks the Emscripten
// build actually exposes. Augment them here (no vendor file is modified).
type JS7zRuntime = MainModule & {
	onExit?: (exitCode: number) => void;
	callMain: (args: string[]) => void;
};

// ---------------------------------------------------------------------------
// 7z archive: read all files into JS7z's virtual FS, compress into a .7z
// archive, and produce a single ReadableStream of the compressed bytes.
// ---------------------------------------------------------------------------
export async function createArchiveStream(files: File[]): Promise<ReadableStream<Uint8Array>> {
	const js7z = (await JS7z({ locateFile: () => js7zWasmUrl })) as JS7zRuntime;
	const inputDir = '/in';
	const outputDir = '/out';
	js7z.FS.mkdir(inputDir);
	js7z.FS.mkdir(outputDir);

	for (const file of files) {
		const uniqueName = makeUnique(file.name);
		const data = new Uint8Array(await file.arrayBuffer());
		js7z.FS.writeFile(`${inputDir}/${uniqueName}`, data);
	}

	let exitCode = -1;
	js7z.onExit = (code: number) => {
		exitCode = code;
	};

	js7z.callMain(['a', `${outputDir}/archive.7z`, `${inputDir}/*`]);

	if (exitCode !== 0) {
		throw new Error(`7z compression failed with exit code ${exitCode}`);
	}

	const archiveBytes = new Uint8Array(js7z.FS.readFile(`${outputDir}/archive.7z`));

	js7z.FS.rmdir(inputDir);
	js7z.FS.rmdir(outputDir);

	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(archiveBytes);
			controller.close();
		},
	});
}

// ---------------------------------------------------------------------------
// ECE (RFC 8188) streaming encrypt/decrypt over AES-256-GCM.
//
// Wire format v3:
//   [16-byte random salt][1-byte version][4-byte record size, BE]
//   [record_0][record_1]...
//
// Each record is the AES-256-GCM ciphertext of a RECORD_SIZE-sized plaintext
// chunk (last record may be shorter). Per-record nonce = deterministic 12-byte
// nonceBase XOR sequence_number (last 4 bytes BE).
//
// The file key is HKDF(IKM, salt=header_salt). The salt is REAL: it feeds
// both Argon2id (password path) and HKDF (all paths), so identical passwords
// over different uploads yield different keys and ciphertexts.
// ---------------------------------------------------------------------------

interface WorkerSlot {
	worker: Worker;
	ready: Promise<void>;
}

function makeWorkerSlot(ikmB64: string, saltB64: string, op: 'encrypt' | 'decrypt'): WorkerSlot {
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
	worker.postMessage({ type: 'init', ikmB64, saltB64, op });
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

/** Build the 21-byte v3 header: [salt][version][record_size BE]. */
function buildHeader(salt: Uint8Array): Uint8Array {
	const header = new Uint8Array(HEADER_LENGTH);
	header.set(salt, 0);
	header[SALT_LENGTH] = SCHEME_VERSION;
	const view = new DataView(header.buffer, SALT_LENGTH + VERSION_LENGTH, RECORD_SIZE_FIELD_LENGTH);
	view.setUint32(0, RECORD_SIZE);
	return header;
}

/** Parse the v3 header. Returns { salt, version, recordSize }. */
function parseHeader(bytes: Uint8Array): { salt: Uint8Array; version: number; recordSize: number } {
	const salt = bytes.slice(0, SALT_LENGTH);
	const version = bytes[SALT_LENGTH];
	const recordSize = new DataView(bytes.buffer, bytes.byteOffset + SALT_LENGTH + VERSION_LENGTH, RECORD_SIZE_FIELD_LENGTH).getUint32(0);
	return { salt, version, recordSize };
}

// ---------------------------------------------------------------------------
// createEncryptedStream
//
// Reads the input stream, slices into RECORD_SIZE chunks, encrypts each in a
// worker, and emits the v3 header + ciphertext records in order. Returns the
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
	// Generate the per-file salt FIRST - it feeds both Argon2id (password path)
	// and HKDF (all paths), and travels in the wire header.
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const ikm = await resolveIkM(ikmOverride ?? null, password ?? null, salt);
	const keySecret = base64url(ikm);
	const ikmB64 = keySecret;
	const saltB64 = base64url(salt);

	const slot = makeWorkerSlot(ikmB64, saltB64, 'encrypt');
	const header = buildHeader(salt);

	const reader = inputStream.getReader();
	let buffer = new Uint8Array(0);
	let processed = 0;
	let seq = 0;
	let inputDone = false;

	const readMore = async (): Promise<Uint8Array | null> => {
		const { done, value } = await reader.read();
		if (done) return null;
		return value;
	};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			controller.enqueue(header);
		},
		async pull(controller) {
			for (;;) {
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

				const isFinal = inputDone;
				const chunkSize = isFinal ? buffer.length : RECORD_SIZE;
				const chunk = buffer.slice(0, chunkSize);
				buffer = buffer.slice(chunkSize);

				const index = seq++;
				const ciphertext = await workerProcess(slot, index, chunk);
				processed += chunkSize;
				onProgress?.(processed, origSize);
				controller.enqueue(ciphertext);

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
// Reads the v3 wire format, strips the header (extracting the real salt),
// resolves the IKM against that salt, then decrypts each record in a worker.
// Emits plaintext chunks in order.
// ---------------------------------------------------------------------------
export async function createDecryptedStream(
	inputStream: ReadableStream<Uint8Array>,
	keySecret: string,
	password?: string,
	origSize?: number,
	onProgress?: (processed: number, total?: number) => void,
): Promise<ReadableStream<Uint8Array>> {
	const reader = inputStream.getReader();

	// Read the header first - the salt inside is required to derive the IKM.
	let buffer = new Uint8Array(0);
	const readMore = async (): Promise<Uint8Array | null> => {
		const { done, value } = await reader.read();
		if (done) return null;
		return value;
	};

	while (buffer.length < HEADER_LENGTH) {
		const value = await readMore();
		if (value === null) throw new Error('Ciphertext ended before header');
		const combined = new Uint8Array(buffer.length + value.length);
		combined.set(buffer);
		combined.set(value, buffer.length);
		buffer = combined;
	}

	const { salt, version, recordSize } = parseHeader(buffer);
	buffer = buffer.slice(HEADER_LENGTH);

	if (version !== SCHEME_VERSION) {
		throw new Error(`Unsupported encryption version: ${version} (expected ${SCHEME_VERSION})`);
	}

	// Resolve IKM using the real salt from the header.
	const ikm = password ? await resolveIkM(null, password, salt) : base64urlToBytes(keySecret);
	const ikmB64 = base64url(ikm);
	const saltB64 = base64url(salt);

	const slot = makeWorkerSlot(ikmB64, saltB64, 'decrypt');

	let seq = 0;
	let processed = 0;
	let inputDone = false;
	const CHUNK = recordSize; // honour the record size from the header

	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			for (;;) {
				if (buffer.length < CHUNK) {
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

				const isFinal = inputDone;
				const chunkSize = isFinal ? buffer.length : CHUNK;
				const chunk = buffer.slice(0, chunkSize);
				buffer = buffer.slice(chunkSize);

				const index = seq++;
				const plaintext = await workerProcess(slot, index, chunk);
				processed += plaintext.byteLength;
				onProgress?.(processed, origSize);
				controller.enqueue(plaintext);

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
