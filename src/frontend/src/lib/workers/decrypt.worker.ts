import { getChunkIv } from '../functions/encryption';

let aesKey: CryptoKey | null = null;
let baseIv: Uint8Array | null = null;

interface InitMessage {
	type: 'init';
	keyRaw: ArrayBuffer;
	baseIv: ArrayBuffer;
}

interface DecryptMessage {
	type: 'decrypt';
	index: number;
	chunk: ArrayBuffer;
}

self.addEventListener('message', async (ev: MessageEvent) => {
	const msg = ev.data as InitMessage | DecryptMessage;
	try {
		if (msg.type === 'init') {
			// Import the raw key for AES-GCM
			aesKey = await crypto.subtle.importKey('raw', msg.keyRaw, { name: 'AES-GCM' }, false, [
				'decrypt'
			]);
			baseIv = new Uint8Array(msg.baseIv);
			(self as any).postMessage({ type: 'ready' });
			return;
		}

		if (msg.type === 'decrypt') {
			if (!aesKey || !baseIv) {
				(self as any).postMessage({
					type: 'error',
					index: msg.index,
					message: 'Worker not initialized'
				});
				return;
			}

			const chunk = new Uint8Array(msg.chunk);
			const iv = getChunkIv(baseIv, msg.index);
			try {
				const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
				const decrypted = await crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv: iv as any },
					aesKey,
					buf
				);
				(self as any).postMessage({ type: 'decrypted', index: msg.index, decrypted }, [decrypted]);
			} catch (e: any) {
				(self as any).postMessage({
					type: 'error',
					index: msg.index,
					message: e?.message ?? String(e)
				});
			}
		}
	} catch (e: any) {
		(self as any).postMessage({ type: 'error', message: e?.message ?? String(e) });
	}
});
