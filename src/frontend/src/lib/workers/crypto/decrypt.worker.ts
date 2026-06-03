import { createCryptoWorkerHandler } from './shared';

const handle = createCryptoWorkerHandler('decrypt');

self.addEventListener('message', async (ev) => {
	try {
		const result = await handle(ev.data);
		if (result?.type === 'decrypted') {
			(self as any).postMessage(result, [result.decrypted]);
		} else {
			(self as any).postMessage(result);
		}
	} catch (e: unknown) {
		(self as any).postMessage({ type: 'error', message: (e as Error)?.message ?? String(e) });
	}
});
