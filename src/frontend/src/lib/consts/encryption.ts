// Deterministic derivation constants
export const HKDF_SALT_STR = 'chithi-salt-v1';
export const HKDF_IV_STR = 'chithi-iv-v1';

export const MAX_ARGON2_MEMORY_KIB = 512 * 1024 - 1; // cap: <512 MiB in KiB units
export const DEFAULT_ARGON2_MEMORY_KIB = 64 * 1024; // 64 MiB default
export const DEFAULT_ARGON2_ITERATIONS = 8;
