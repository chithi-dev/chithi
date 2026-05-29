import { CHUNK_SIZE as STREAM_CHUNK_SIZE, WORKER_CONCURRENCY } from '#consts/concurrency';
import { HKDF_IV_STR } from '#consts/encryption';
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
	const n = usedNames.get(name) ?? 0;
	usedNames.set(name, n + 1);
	if (n === 0) return name;
	const i = name.lastIndexOf('.');
	return i > 0 ? `${name.slice(0, i)}_${n}${name.slice(i)}` : `${name}_${n}`;
};

async function deriveSecrets(ikm: Uint8Array, password?: string) {
	const enc = new TextEncoder();
	const derivedSalt = new Uint8Array(await crypto.subtle.digest('SHA-256', [...ikm, ...enc.encode(HKDF_IV_STR)]));
	let finalIKM = ikm;
	if (password?.length) {
		const pb = await argon2Derive(enc.encode(password), derivedSalt.slice(0, 16), 32, 16384, 32, 1);
		finalIKM = xorBytes(ikm, pb);
	}
	const hkdfSalt = new Uint8Array(await crypto.subtle.digest('SHA-256', [...finalIKM, ...enc.encode('aes-key')])).slice(0, 16);
	const baseIv = new Uint8Array(await crypto.subtle.digest('SHA-256', [...finalIKM, ...enc.encode(HKDF_IV_STR)])).slice(0, 12);
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);
	return { aesKey, baseIv, finalIKM };
}

async function splitInputRanges(stream: ReadableStream<Uint8Array>, chunkSize: number, concurrency: number) {
	const ranges: { range: ReadableStream<Uint8Array>; startChunkIndex: number }[] = [];
	const chunks = await Array.fromAsync(stream);
	const totalBytes = chunks.reduce((n, c) => n + c.byteLength, 0);
	const buf = new Uint8Array(totalBytes);
	let off = 0;
	for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
	if (concurrency < 1 || totalBytes === 0) return ranges;
	const perWorker = Math.ceil(totalBytes / concurrency);
	let idx = 0;
	for (let i = 0; i < concurrency && idx * chunkSize < buf.byteLength; i++) {
		const start = i * perWorker;
		const end = Math.min((i + 1) * perWorker, totalBytes);
		const count = Math.ceil((end - start) / chunkSize);
		if (count <= 0) continue;
		let pos = start;
		ranges.push({
			range: new ReadableStream<Uint8Array>({
				pull(controller) {
					while (pos < end) { const n = Math.min(end - pos, chunkSize); controller.enqueue(buf.slice(pos, pos + n)); pos += n; }
					controller.close();
				}
			}),
			startChunkIndex: idx
		});
		idx += count;
	}
	return ranges;
}

async function writeZipFiles(zip: ZipWriter<any>, writable: WritableStream<Uint8Array>, files: File[], password?: string, signal?: AbortSignal) {
	const opts = { password: password?.length ? password : undefined, encryptionStrength: password?.length ? 3 : undefined, level: 9, signal };
	try {
		for (const file of files) {
			const name = (file as any).relativePath ?? file.name;
			try { await zip.add(makeUnique(name), file.stream(), opts); }
			catch (err) {
				if (String(err).includes('already exists')) await zip.add(makeUnique(name), file.stream(), opts);
				else throw err;
			}
		}
		await zip.close();
	} catch (err) {
		console.error('Error creating zip stream:', err);
		await writable.abort(err).catch(() => {});
	}
}

export async function createZipStream(
	files: File[],
	password?: string,
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const { readable, writable } = new TransformStream();
	const zipWriter = new ZipWriter(writable, { bufferedWrite: true, useCompressionStream: true });
	writeZipFiles(zipWriter, writable, files, password, signal);
	return readable;
}

export async function createEncryptedStream(stream: ReadableStream<Uint8Array>, password?: string, originalSize?: number, onProgress?: (processed: number, total?: number) => void, ikm_override?: Uint8Array) {
	const ikm = ikm_override ?? crypto.getRandomValues(new Uint8Array(32));
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);
	const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
	const keyCopy = keyRaw.slice(0) as ArrayBuffer;
	const ivCopy = baseIv.buffer.slice(0) as ArrayBuffer;
	const Worker = (await import('#workers/encryption.worker?worker')).default;
	const ranges = await splitInputRanges(stream, STREAM_CHUNK_SIZE, WORKER_CONCURRENCY);
	return {
		stream: concatStreams(ranges.map(({ range }) => {
			let worker: Worker | null = null;
			return new ReadableStream<Uint8Array>({
				async start(controller) {
					worker = new Worker();
					let init = false, bytes = 0;
					worker.onmessage = (ev) => {
						if (!init && ev.data?.type === 'init') {
							init = true;
							worker!.postMessage({ type: 'init' as const, keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
							return;
						}
						if (ev.data?.type === 'encrypted') {
							const buf = ev.data.encrypted;
							bytes += buf.byteLength;
							controller.enqueue(new Uint8Array(buf));
							onProgress?.(bytes, originalSize);
						}
					};
					const io = new TransformStream<Uint8Array, Uint8Array>();
					let i = 0;
					(async () => {
						try { for await (const chunk of io.readable) worker!.postMessage({ type: 'data' as const, index: i++, chunk }, [chunk]); } catch {}
					})();
					range.pipeTo(io.writable).catch(() => {});
				},
				cancel() { if (worker) try { worker.terminate(); } catch {} }
			});
		})),
		keySecret: base64url(ikm)
	};
}

export async function createDecryptedStream(stream: ReadableStream<Uint8Array>, keySecret: string, password?: string, originalSize?: number, onProgress?: (processed: number, total?: number) => void) {
	const ikm = base64urlToBytes(keySecret);
	const { aesKey, baseIv } = await deriveSecrets(ikm, password);
	const keyRaw = await crypto.subtle.exportKey('raw', aesKey);
	const keyCopy = keyRaw.slice(0) as ArrayBuffer;
	const ivCopy = baseIv.buffer.slice(0) as ArrayBuffer;
	const Worker = (await import('#workers/encryption.worker?worker')).default;
	const TAG_LEN = 16;
	const chunkSize = STREAM_CHUNK_SIZE + TAG_LEN;
	const totalChunks = Math.ceil((originalSize ?? 0) / STREAM_CHUNK_SIZE);
	const perWorker = Math.ceil(totalChunks / WORKER_CONCURRENCY);
	return {
		stream: concatStreams(
			Array.from({ length: WORKER_CONCURRENCY }, (_, i) => ({
				start: i * perWorker,
				end: Math.min((i + 1) * perWorker, totalChunks)
			})).map(({ start, end }) => {
				let worker: Worker | null = null;
				return new ReadableStream<Uint8Array>({
					async start(controller) {
						worker = new Worker();
						let init = false, bytes = 0;
						worker.onmessage = (ev) => {
							if (!init && ev.data?.type === 'init') {
								init = true;
								worker!.postMessage({ type: 'init' as const, keyRaw: keyCopy, baseIv: ivCopy }, [keyCopy, ivCopy]);
								return;
							}
							if (ev.data?.type === 'decrypted') {
								const buf = ev.data.decrypted;
								bytes += buf.byteLength;
								controller.enqueue(new Uint8Array(buf));
								onProgress?.(bytes, originalSize);
							}
						};
						const io = new TransformStream<Uint8Array, Uint8Array>();
						let idx = start;
						(async () => {
							try { for await (const chunk of io.readable) worker!.postMessage({ type: 'data' as const, index: idx++, chunk }, [chunk]); } catch {}
						})();
						const reader = stream.getReader();
						let buf = new Uint8Array(0);
						(async () => {
							try {
								while (idx < end) {
									while (buf.length < chunkSize) {
										const { done, value } = await reader.read();
										if (done) break;
										const n = new Uint8Array(buf.length + value.length);
										n.set(buf); n.set(value, buf.length);
										buf = n;
									}
									const c = buf.slice(0, Math.min(buf.length, chunkSize));
									buf = buf.slice(c.length);
									await io.writable.getWriter().write(new Uint8Array(c.buffer));
									idx++;
								}
							} finally {
								await reader.cancel();
								io.writable.getWriter().close().catch(() => {});
							}
						})();
					},
					cancel() { if (worker) try { worker.terminate(); } catch {} }
				});
			})
		),
		keySecret: base64url(ikm)
	};
}

function concatStreams<T>(streams: ReadableStream<T>[]) {
	let i = 0, started = false;
	async function pull(ctrl: ReadableStreamDefaultController<T>) {
		if (i >= streams.length) { ctrl.close(); return; }
		const reader = streams[i++].getReader();
		try { for (;;) { const { done, value } = await reader.read(); if (done) break; ctrl.enqueue(value); } }
		finally { reader.releaseLock(); }
		await pull(ctrl);
	}
	return new ReadableStream<T>({
		pull(ctrl) { if (!started) { started = true; pull(ctrl); } },
		cancel() { for (const s of streams) s.cancel().catch(() => {}); }
	});
}
