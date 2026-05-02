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
			// Initialize thread pool with provided number of threads or hardware concurrency
			const threads = msg.threads ?? navigator.hardwareConcurrency ?? 4;
			await initThreadPool(threads);

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
			let totalSize = 0;
			for (const c of msg.chunks) totalSize += c.byteLength;
			const flattened = new Uint8Array(totalSize);
			let offset = 0;
			for (const c of msg.chunks) {
				flattened.set(new Uint8Array(c), offset);
				offset += c.byteLength;
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
