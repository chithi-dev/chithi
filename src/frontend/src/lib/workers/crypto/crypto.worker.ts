import { wasmEncryptChunk, wasmDecryptChunk, wasmGetChunkNonce, ensureInitialized } from '#wasm/chithi_wasm';

let keyRaw: Uint8Array | null = null;
let baseIv: Uint8Array | null = null;
let wasmReady = false;

self.onmessage = async (e: MessageEvent) => {
    const msg = e.data;
    try {
        if (msg.type === 'init') {
            keyRaw = new Uint8Array(msg.keyRaw);
            baseIv = new Uint8Array(msg.baseIv);
            await ensureInitialized();
            wasmReady = true;
            self.postMessage({ type: 'ready' });
            return;
        }
        if (!wasmReady || !keyRaw || !baseIv) {
            self.postMessage({ type: 'error', index: msg.index, message: 'Worker not initialized' });
            return;
        }
        const chunk = new Uint8Array(msg.chunk);
        const nonce = wasmGetChunkNonce(baseIv, msg.index);
        if (msg.type === 'encrypt') {
            const result = wasmEncryptChunk(chunk, keyRaw, nonce);
            self.postMessage({ type: 'encrypted', index: msg.index, encrypted: result });
        } else if (msg.type === 'decrypt') {
            const result = wasmDecryptChunk(chunk, keyRaw, nonce);
            self.postMessage({ type: 'decrypted', index: msg.index, decrypted: result });
        }
    } catch (err) {
        self.postMessage({ type: 'error', index: msg?.index, message: (err as Error)?.message ?? String(err) });
    }
};
