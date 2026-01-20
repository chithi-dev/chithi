import { getChunkIv } from '../functions/encryption';

let aesKey: CryptoKey | null = null;
let baseIv: Uint8Array | null = null;

interface InitMessage {
	type: 'init';
	keyRaw: ArrayBuffer;
	baseIv: ArrayBuffer;
}

interface EncryptMessage {
	type: 'encrypt';
	index: number;
	chunk: ArrayBuffer;
}

self.addEventListener('message', async (ev: MessageEvent) => {
	const msg = ev.data as InitMessage | EncryptMessage;
	try {
		if (msg.type === 'init') {
			// Import the raw key for AES-GCM
			aesKey = await crypto.subtle.importKey('raw', msg.keyRaw, { name: 'AES-GCM' }, false, [
				'encrypt'
			]);
			baseIv = new Uint8Array(msg.baseIv);
			(self as any).postMessage({ type: 'ready' });
			return;
		}

		if (msg.type === 'encrypt') {
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
				const encrypted = await crypto.subtle.encrypt(
					{ name: 'AES-GCM', iv: iv as any },
					aesKey,
					buf
				);
				// Transfer the encrypted ArrayBuffer back
				(self as any).postMessage({ type: 'encrypted', index: msg.index, encrypted }, [encrypted]);
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
