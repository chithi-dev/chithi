import init, {
	decrypt_chunk,
	decrypt_chunks_parallel,
	encrypt_chunk,
	encrypt_chunks_parallel,
	initThreadPool
} from '#vendor/encryption/chithi_wasm';

let wasmReady = false;
let keyRaw: Uint8Array | null = null;
let baseIv: Uint8Array | null = null;

interface InitMessage {
	type: 'init';
	keyRaw: ArrayBuffer;
	baseIv: ArrayBuffer;
	threads?: number;
}

interface PipelineMessage {
	type: 'encrypt' | 'decrypt';
	index: number;
	chunk: ArrayBuffer;
	useCompression: boolean;
}

interface ParallelPipelineMessage {
	type: 'encrypt_parallel' | 'decrypt_parallel';
	startIndex: number;
	chunks: ArrayBuffer[];
	useCompression: boolean;
}

self.addEventListener('message', async (ev: MessageEvent) => {
	const msg = ev.data as InitMessage | PipelineMessage | ParallelPipelineMessage;
	try {
		if (msg.type === 'init') {
			await init();
			// Some browsers/environments cannot clone WebAssembly.Memory for worker pools.
			// Fall back to single-thread mode rather than failing all uploads.
			const threads = navigator.hardwareConcurrency ?? msg.threads ?? 4;
			if (threads > 1) {
				try {
					await initThreadPool(threads);
				} catch {
					// Ignore and continue without rayon workers.
				}
			}

			keyRaw = new Uint8Array(msg.keyRaw);
			baseIv = new Uint8Array(msg.baseIv);
			wasmReady = true;
			(self as any).postMessage({ type: 'ready' });
			return;
		}

		if (!wasmReady || !keyRaw || !baseIv) {
			(self as any).postMessage({
				type: 'error',
				message: 'Worker or WASM not initialized'
			});
			return;
		}

		if (msg.type === 'encrypt' || msg.type === 'decrypt') {
			const chunk = new Uint8Array(msg.chunk);
			try {
				const result =
					msg.type === 'encrypt'
						? encrypt_chunk(chunk, keyRaw, baseIv, msg.index, msg.useCompression)
						: decrypt_chunk(chunk, keyRaw, baseIv, msg.index, msg.useCompression);

				const buffer = result.buffer;
				(self as any).postMessage(
					{
						type: msg.type === 'encrypt' ? 'encrypted' : 'decrypted',
						index: msg.index,
						data: buffer
					},
					[buffer]
				);
			} catch (e: any) {
				(self as any).postMessage({ type: 'error', index: msg.index, message: String(e) });
			}
		} else if (msg.type === 'encrypt_parallel' || msg.type === 'decrypt_parallel') {
			// Create flattened buffer with 4-byte little-endian length prefixes
			let totalSize = 0;
			for (const c of msg.chunks) totalSize += c.byteLength + 4;
			const flattened = new Uint8Array(totalSize);
			const view = new DataView(flattened.buffer, flattened.byteOffset, flattened.byteLength);
			let offset = 0;
			for (const c of msg.chunks) {
				const len = c.byteLength;
				view.setUint32(offset, len, true); // little-endian
				offset += 4;
				flattened.set(new Uint8Array(c), offset);
				offset += len;
			}

			const onProgress = (p: number) => {
				(self as any).postMessage({
					type: 'progress',
					startIndex: msg.startIndex,
					progress: p
				});
			};

			try {
				const result =
					msg.type === 'encrypt_parallel'
						? encrypt_chunks_parallel(
								flattened,
								keyRaw,
								baseIv,
								msg.startIndex,
								msg.useCompression,
								onProgress
							)
						: decrypt_chunks_parallel(
								flattened,
								keyRaw,
								baseIv,
								msg.startIndex,
								msg.useCompression,
								onProgress
							);

				const buffer = result.buffer;
				(self as any).postMessage(
					{
						type: msg.type === 'encrypt_parallel' ? 'encrypted_parallel' : 'decrypted_parallel',
						startIndex: msg.startIndex,
						data: buffer
					},
					[buffer]
				);
			} catch (e: any) {
				(self as any).postMessage({
					type: 'error',
					startIndex: msg.startIndex,
					message: String(e)
				});
			}
		}
	} catch (e: any) {
		(self as any).postMessage({ type: 'error', message: String(e) });
	}
});
