import init, {
    type InitInput,
    compress,
    decompress,
    validate_7z,
    argon2_derive,
    generate_ikm
} from './wasm_binding.js';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module. Safe to call multiple times.
 */
export async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = init().then(() => { initialized = true; }).finally(() => { initPromise = null; });
    return initPromise;
}

export interface SevenEntry {
    name: string;
    data: Uint8Array;
}

/**
 * Compress files into a 7z archive.
 * Fully typed — accepts file names and data as separate typed arrays.
 */
export function compress7z(entries: { name: string; data: Uint8Array }[]): Uint8Array {
    const names = entries.map(e => e.name);
    const datas = entries.map(e => e.data);
    return compress(names, datas);
}

/**
 * Decompress a 7z archive.
 * Fully typed — callback receives (name: string, data: Uint8Array) for each entry.
 */
export function decompress7z(data: Uint8Array): Promise<SevenEntry[]> {
    return new Promise((resolve, reject) => {
        try {
            const entries: SevenEntry[] = [];
            decompress(data, '', (name: string, entryData: Uint8Array) => {
                entries.push({ name, data: entryData });
            });
            resolve(entries);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Validate that the given bytes are a 7z archive.
 */
export function validate7z(data: Uint8Array): boolean {
    return validate_7z(data);
}

/**
 * Derive a key using Argon2id.
 * Fully typed — accepts Uint8Array inputs, returns Uint8Array output.
 */
export function argon2Derive(
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    memoryCostKib: number,
    hashLength = 32
): Uint8Array {
    return argon2_derive(password, salt, iterations, memoryCostKib, hashLength);
}

/**
 * Generate a random 32-byte IKM.
 */
export function generateIkm(): Uint8Array {
    return generate_ikm();
}
