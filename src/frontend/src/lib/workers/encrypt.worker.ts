import { getChunkIv } from '#functions/encryption';

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

const postMessage = (msg: unknown, transfer?: Transferable[]) =>
	(self as Worker).postMessage(msg, { transfer });

self.addEventListener('message', async (ev: MessageEvent<InitMessage | EncryptMessage>) => {
	const msg = ev.data;
	try {
		if (msg.type === 'init') {
			aesKey ??= await crypto.subtle.importKey(
				'raw', msg.keyRaw, { name: 'AES-GCM' }, false, ['encrypt']
			);
			baseIv = new Uint8Array(msg.baseIv);
			postMessage({ type: 'ready' as const });
			return;
		}

		if (msg.type === 'encrypt') {
			aesKey ??= await crypto.subtle.importKey(
				'raw', msg.keyRaw, { name: 'AES-GCM' }, false, ['encrypt']
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
				const encrypted = await crypto.subtle.encrypt(
					{ name: 'AES-GCM', iv: iv as ArrayBuffer }, aesKey, buf
				);
				postMessage({ type: 'encrypted' as const, index: msg.index, encrypted }, [encrypted]);
			} catch (e) {
				const err = e instanceof Error ? e : new Error(String(e));
				postMessage({ type: 'error' as const, index: msg.index, message: err.message });
			}
		}
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		postMessage({ type: 'error' as const, message: err.message });
	}
});
