import { getChunkIv } from '#functions/encryption';

interface InitMessage {
	type: 'init';
	keyRaw: ArrayBuffer;
	baseIv: ArrayBuffer;
}

interface ProcessMessage {
	type: 'encrypt' | 'decrypt';
	index: number;
	chunk: ArrayBuffer;
}

let aesKey: CryptoKey | null = null;
let baseIv: Uint8Array | null = null;

/**
 * Shared crypto worker handler.
 * Pass `op: 'encrypt' | 'decrypt'` to configure the operation.
 * Returns `{ encrypted }` or `{ decrypted }` based on the operation.
 */
export function createCryptoWorkerHandler(op: 'encrypt' | 'decrypt') {
	const resultKey = op === 'encrypt' ? 'encrypted' : 'decrypted';

	return async (msg: InitMessage | ProcessMessage) => {
		if (msg.type === 'init') {
			aesKey = await crypto.subtle.importKey('raw', msg.keyRaw, { name: 'AES-GCM' }, false, [op]);
			baseIv = new Uint8Array(msg.baseIv);
			return { type: 'ready' as const };
		}

		if (msg.type !== 'encrypt' && msg.type !== 'decrypt') return;
		if (!aesKey || !baseIv) {
			return { type: 'error' as const, index: msg.index, message: 'Worker not initialized' };
		}

		try {
			const chunk = new Uint8Array(msg.chunk);
			const iv = getChunkIv(baseIv, msg.index);
			const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);

			const result = await crypto.subtle[op](
				{ name: 'AES-GCM', iv: iv as any },
				aesKey,
				buf
			);
			return { type: resultKey, index: msg.index, [resultKey]: result };
		} catch (e: unknown) {
			return {
				type: 'error' as const,
				index: msg.index,
				name: (e as Error)?.name,
				message: (e as Error)?.message ?? String(e)
			};
		}
	};
}
