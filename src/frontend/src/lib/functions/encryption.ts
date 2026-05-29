import { DEFAULT_ARGON2_ITERATIONS, DEFAULT_ARGON2_MEMORY_KIB, MAX_ARGON2_MEMORY_KIB } from '#consts/encryption';

export function base64url(u8: Uint8Array) {
  return btoa(Array.from(u8).map(b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str: string) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Uint8Array.from(b64, c => c.charCodeAt(0));
}

export function xorBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
  return out;
}

export async function deriveAESKeyFromIKM(ikm: Uint8Array, hkdfSalt: Uint8Array) {
  const derivedBits = await argon2Derive(ikm, hkdfSalt, DEFAULT_ARGON2_ITERATIONS, DEFAULT_ARGON2_MEMORY_KIB, 32, 1);
  return crypto.subtle.importKey('raw', derivedBits as unknown as ArrayBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function argon2Derive(
  password: string | Uint8Array,
  salt: Uint8Array,
  iterations: number,
  memorySize = DEFAULT_ARGON2_MEMORY_KIB,
  hashLength = 32,
  parallelism = 1
) {
  const memKb = Math.min(memorySize, MAX_ARGON2_MEMORY_KIB);
  const { argon2id } = await import('hash-wasm');
  return argon2id({ password, salt, iterations, memorySize: memKb, hashLength, parallelism, outputType: 'binary' });
}

export type InnerEncryptionMeta = {
  cipher: 'AES-GCM';
  hkdf: { hash: 'SHA-512'; salt: string };
  iv: string;
  size?: number;
};

export function getChunkIv(baseIv: Uint8Array, chunkIndex: number) {
  const iv = new Uint8Array(baseIv);
  const view = new DataView(iv.buffer, iv.byteOffset);
  view.setUint32(8, view.getUint32(8, false) ^ chunkIndex, false);
  return iv;
}
