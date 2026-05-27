import { getChunkIv } from '#functions/encryption';

interface InitMessage { type: 'init'; keyRaw: ArrayBuffer; baseIv: ArrayBuffer; mode: 'encrypt' | 'decrypt' }

self.addEventListener('message', async (ev) => {
	const msg = ev.data as InitMessage;

	if (msg.type === 'init') {
		const aesKey = await crypto.subtle.importKey(
			'raw', new Uint8Array(msg.keyRaw), { name: 'AES-GCM' }, false, [msg.mode]
		);
		const baseIv = new Uint8Array(msg.baseIv);

		let chunkIndex = 0;
		try {
			for await (const raw of (self as any).inputQueue) {
				if (!(raw instanceof ArrayBuffer)) break;
				const iv = getChunkIv(baseIv, chunkIndex++);
				if (msg.mode === 'encrypt') {
					const encrypted = await crypto.subtle.encrypt(
						{ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
						aesKey, raw
					);
					(self as any).outputQueue.enqueue(encrypted);
				} else {
					const decrypted = await crypto.subtle.decrypt(
						{ name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
						aesKey, raw
					);
					(self as any).outputQueue.enqueue(decrypted);
				}
			}
		} catch { /* EOF — worker done */ }

		(self as any).outputQueue.close();
	}
});
