import init, { compress, decompress, validate_7z, argon2_derive, generate_ikm } from '$lib/wasm/chithi_core.js';

let ready = false;

async function initWasm() {
    await init();
    ready = true;
    postMessage({ type: 'ready' });
}

initWasm().catch(() => {
    ready = false;
    postMessage({ type: 'error', message: '7z worker init failed' });
});

export interface MsgIn {
    type: 'compress' | 'decompress' | 'validate' | 'argon2_derive' | 'generate_ikm';
    id: number;
}

self.onmessage = async function (e: MessageEvent) {
    if (!ready) {
        postMessage({ type: 'error', id: -1, message: 'Worker not ready' });
        return;
    }

    const msg = e.data as MsgIn & Record<string, any>;

    try {
        switch (msg.type) {
            case 'compress': {
                const entries = msg.entries as { name: string; data: Uint8Array }[];
                const names = entries.map((e: any) => e.name);
                const datas = entries.map((e: any) => e.data);
                const result = compress(names, datas);
                postMessage({ type: 'compressed', id: msg.id, data: result });
                break;
            }
            case 'decompress': {
                const data = msg.data as Uint8Array;
                const entries: Array<{ name: string; data: Uint8Array }> = [];
                decompress(data, '', (name: string, entryData: Uint8Array) => {
                    entries.push({ name, data: entryData });
                });
                postMessage({ type: 'decompressed', id: msg.id, entries });
                break;
            }
            case 'validate': {
                const data = msg.data as Uint8Array;
                const valid = validate_7z(data);
                postMessage({ type: 'validated', id: msg.id, valid });
                break;
            }
            case 'argon2_derive': {
                const result = argon2_derive(
                    msg.password as Uint8Array,
                    msg.salt as Uint8Array,
                    msg.iterations as number,
                    msg.memoryCostKib as number,
                    msg.hashLength as number,
                );
                postMessage({ type: 'derived', id: msg.id, key: result });
                break;
            }
            case 'generate_ikm': {
                const ikm = generate_ikm();
                postMessage({ type: 'ikm_generated', id: msg.id, ikm });
                break;
            }
        }
    } catch (err) {
        postMessage({ type: 'error', id: msg.id, message: String(err) });
    }
};
