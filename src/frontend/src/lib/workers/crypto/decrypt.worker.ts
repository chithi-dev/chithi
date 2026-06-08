import { createCryptoWorkerHandler } from './shared';

const handle = createCryptoWorkerHandler('decrypt');
self.addEventListener('message', async (e) => {
  try {
    const result = await handle(e.data);
    if (result?.type === 'decrypted') (self as any).postMessage(result, [result.decrypted]);
    else (self as any).postMessage(result);
  } catch (e) { (self as any).postMessage({ type: 'error', message: (e as Error)?.message ?? String(e) }); }
});
