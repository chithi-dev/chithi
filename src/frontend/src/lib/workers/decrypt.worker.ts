import { getChunkIv } from '#functions/encryption';

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

const postMessage = (msg: unknown, transfer?: Transferable[]) =>
	(self as Worker).postMessage(msg, { transfer });

self.addEventListener('message', async (ev: MessageEvent<InitMessage | DecryptMessage>) => {
	const msg = ev.data;
	try {
		if (msg.type === 'init') {
			aesKey ??= await crypto.subtle.importKey(
				'raw', msg.keyRaw, { name: 'AES-GCM' }, false, ['decrypt']
			);
			baseIv = new Uint8Array(msg.baseIv);
			postMessage({ type: 'ready' as const });
			return;
		}

		if (msg.type === 'decrypt') {
			aesKey ??= await crypto.subtle.importKey(
				'raw', msg.keyRaw, { name: 'AES-GCM' }, false, ['decrypt']
			);
			baseIv ??= new Uint8Array(msg.baseIv);

			if (!aesKey || !baseIv) {
				postMessage({ type: 'error' as const, index: msg.index, message: 'Worker not initialized' });
				return;
			}

			const chunk = new Uint8Array(msg.chunk);
			const iv = getChunkIv(baseIv, msg.index);
			try {
				const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
				const decrypted = await crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv: iv as ArrayBuffer }, aesKey, buf
				);
				postMessage({ type: 'decrypted' as const, index: msg.index, decrypted }, [decrypted]);
			} catch (e) {
				const err = e instanceof Error ? e : new Error(String(e));
				postMessage({ type: 'error' as const, index: msg.index, name: err.name, message: err.message });
			}
		}
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		postMessage({ type: 'error' as const, name: err.name, message: err.message });
	}
});
