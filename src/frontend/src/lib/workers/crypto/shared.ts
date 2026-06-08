import { getChunkIv } from '#functions/encryption';

let aesKey: CryptoKey | null = null;
let baseIv: Uint8Array | null = null;

export function createCryptoWorkerHandler(op: 'encrypt' | 'decrypt') {
  const key = op === 'encrypt' ? 'encrypted' : 'decrypted';
  return async (msg: any) => {
    if (msg.type === 'init') {
      aesKey = await crypto.subtle.importKey('raw', msg.keyRaw, { name: 'AES-GCM' }, false, [op]);
      baseIv = new Uint8Array(msg.baseIv);
      return { type: 'ready' };
    }
    if (msg.type !== 'encrypt' && msg.type !== 'decrypt' || !aesKey || !baseIv) {
      return msg.type !== 'encrypt' && msg.type !== 'decrypt' ? undefined : { type: 'error', index: msg.index, message: 'Worker not initialized' };
    }
    try {
      const chunk = new Uint8Array(msg.chunk);
      const iv = getChunkIv(baseIv, msg.index);
      const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      const result = await crypto.subtle[op]({ name: 'AES-GCM', iv: iv as any }, aesKey, buf);
      return { type: key, index: msg.index, [key]: result };
    } catch (e) {
      return { type: 'error', index: msg.index, name: (e as Error)?.name, message: (e as Error)?.message ?? String(e) };
    }
  };
}
