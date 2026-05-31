// Deterministic derivation constants
export var HKDF_SALT_STR = 'chithi-salt-v1';
export var HKDF_IV_STR = 'chithi-iv-v1';

// Argon2 parameter defaults and safety cap
export var MAX_ARGON2_MEMORY_KIB = 512 * 1024 - 1; // cap: <512 MiB in KiB units
export var DEFAULT_ARGON2_MEMORY_KIB = 64 * 1024; // 64 MiB default
export var DEFAULT_ARGON2_ITERATIONS = 8;
