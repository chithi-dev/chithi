import { DEFAULT_ARGON2_ITERATIONS, DEFAULT_ARGON2_MEMORY_KIB, MAX_ARGON2_MEMORY_KIB } from '#consts/encryption';
import { argon2DeriveWasm } from '#wasm/chithi_wasm';

export function bytesToBase64(u8: Uint8Array) {
  let binary = '';
  for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string) {
  const bytes = new Uint8Array(atob(b64).length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = atob(b64).charCodeAt(i);
  return bytes;
}

export function base64url(u8: Uint8Array) {
  return bytesToBase64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str: string) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return base64ToBytes(b64);
}

export function xorBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] || 0) ^ (b[i] || 0);
  return out;
}

export async function argon2Derive(
  password: string | Uint8Array,
  salt: Uint8Array,
  iterations: number,
  memorySize = DEFAULT_ARGON2_MEMORY_KIB,
  hashLength = 32,
) {
  const pwdBytes = typeof password === 'string' ? new TextEncoder().encode(password) : password;
  return await argon2DeriveWasm(pwdBytes, salt, iterations, Math.min(memorySize, MAX_ARGON2_MEMORY_KIB), hashLength);
}

export async function deriveEncryptionKey(ikm: Uint8Array, hkdfSalt: Uint8Array): Promise<Uint8Array> {
  return await argon2DeriveWasm(ikm, hkdfSalt, DEFAULT_ARGON2_ITERATIONS, Math.min(DEFAULT_ARGON2_MEMORY_KIB, MAX_ARGON2_MEMORY_KIB), 32);
}

export const CHUNK_SIZE = 64 * 1024;
