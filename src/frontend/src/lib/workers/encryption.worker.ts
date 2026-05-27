import { getChunkIv } from '#functions/encryption';

interface InitMessage { type: 'init'; keyRaw: ArrayBuffer; baseIv: ArrayBuffer }
interface DataMessage { type: 'data'; index: number; chunk: ArrayBuffer }

let aesKey: CryptoKey | null = null;
let baseIv: Uint8Array | null = null;

const ensureInitialized = async (keyRaw: ArrayBuffer, baseIvSource: ArrayBuffer) => {
	aesKey ??= await crypto.subtle.importKey('raw', keyRaw, { name: 'AES-GCM' }, false, ['encrypt']);
	baseIv = new Uint8Array(baseIvSource);
};

self.addEventListener('message', async (ev) => {
	const msg = ev.data as InitMessage | DataMessage;

	if (msg.type === 'init') {
		await ensureInitialized(msg.keyRaw, msg.baseIv);
		return;
	}

	if (msg.type === 'data' && aesKey && baseIv) {
		try {
			const iv = getChunkIv(baseIv, msg.index);
			const buf = new Uint8Array(msg.chunk).buffer.slice(0);
			const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer }, aesKey, buf);
			(self as any).postMessage({ type: 'encrypted' as const, index: msg.index, encrypted }, [encrypted]);
		} catch { /* worker error */ }
	}
});
