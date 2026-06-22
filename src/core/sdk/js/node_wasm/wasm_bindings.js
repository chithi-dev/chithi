/* @ts-self-types="./wasm_bindings.d.ts" */

class WasmKeychain {
    static __wrap(ptr) {
        const obj = Object.create(WasmKeychain.prototype);
        obj.__wbg_ptr = ptr;
        WasmKeychainFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmKeychainFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmkeychain_free(ptr, 0);
    }
    /**
     * Decrypt metadata using ChaCha20-Poly1305.
     * @param {Uint8Array} data
     * @returns {string}
     */
    decryptMetadata(data) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.wasmkeychain_decryptMetadata(this.__wbg_ptr, ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Encrypt metadata using ChaCha20-Poly1305.
     * @param {string} metadata
     * @returns {Uint8Array}
     */
    encryptMetadata(metadata) {
        const ptr0 = passStringToWasm0(metadata, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkeychain_encryptMetadata(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Export the auth key (32 bytes).
     * @returns {Uint8Array}
     */
    exportAuthKey() {
        const ret = wasm.wasmkeychain_exportAuthKey(this.__wbg_ptr);
        return ret;
    }
    /**
     * Create a keychain derived from a password.
     * @param {string} password
     * @returns {WasmKeychain}
     */
    static fromPassword(password) {
        const ptr0 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkeychain_fromPassword(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmKeychain.__wrap(ret[0]);
    }
    /**
     * Generate a random shared secret (base64-encoded).
     * @returns {string}
     */
    generateSecret() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.wasmkeychain_generateSecret(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Get the initial keying material (32 bytes).
     * @returns {Uint8Array}
     */
    ikm() {
        const ret = wasm.wasmkeychain_ikm(this.__wbg_ptr);
        return ret;
    }
    /**
     * Create a new keychain with random key material.
     */
    constructor() {
        const ret = wasm.wasmkeychain_new();
        this.__wbg_ptr = ret;
        WasmKeychainFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Get the salt (32 bytes).
     * @returns {Uint8Array}
     */
    salt() {
        const ret = wasm.wasmkeychain_salt(this.__wbg_ptr);
        return ret;
    }
    /**
     * Re-derive all keys from a new password.
     * @param {string} password
     */
    setPassword(password) {
        const ptr0 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkeychain_setPassword(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Sign data with Ed25519.
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    sign(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkeychain_sign(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * Verify an Ed25519 signature.
     * @param {Uint8Array} data
     * @param {Uint8Array} signature
     * @returns {boolean}
     */
    verify(data, signature) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.wasmkeychain_verify(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret !== 0;
    }
}
if (Symbol.dispose) WasmKeychain.prototype[Symbol.dispose] = WasmKeychain.prototype.free;
exports.WasmKeychain = WasmKeychain;

/**
 * Initialize panic hooks so Rust panics appear in the browser console.
 */
function _init_panic_hook() {
    wasm._init_panic_hook();
}
exports._init_panic_hook = _init_panic_hook;

/**
 * Compresses multiple entries into a 7z archive in WebAssembly environment.
 *
 * This function creates a compressed archive from multiple file entries,
 * designed specifically for WASM targets.
 *
 * # Arguments
 * * `entries` - Vector of JavaScript strings representing file names/paths
 * * `datas` - Vector of Uint8Arrays containing the file data corresponding to entries
 * @param {string[]} entries
 * @param {Uint8Array[]} datas
 * @returns {Uint8Array}
 */
function compress(entries, datas) {
    const ptr0 = passArrayJsValueToWasm0(entries, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(datas, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compress(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.compress = compress;

/**
 * Compress files into a 7z archive with optional AES-256 encryption.
 * @param {any[]} names
 * @param {Uint8Array[]} datas
 * @param {string} password
 * @returns {Uint8Array}
 */
function compress_7z(names, datas, password) {
    const ptr0 = passArrayJsValueToWasm0(names, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(datas, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.compress_7z(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.compress_7z = compress_7z;

/**
 * Decompresses a 7z archive in WebAssembly environment.
 *
 * This function is specifically designed for WASM targets and uses JavaScript interop
 * to handle the decompression process with a callback function.
 *
 * # Arguments
 * * `src` - Uint8Array containing the compressed archive data
 * * `pwd` - Password string for encrypted archives (use empty string for unencrypted)
 * * `f` - JavaScript callback function to handle extracted entries
 * @param {Uint8Array} src
 * @param {string} pwd
 * @param {Function} f
 */
function decompress(src, pwd, f) {
    const ptr0 = passStringToWasm0(pwd, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decompress(src, ptr0, len0, f);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}
exports.decompress = decompress;

/**
 * Decompress a 7z archive with optional password.
 * Returns an array of {name, data} objects.
 * @param {Uint8Array} data
 * @param {string} password
 * @returns {any[]}
 */
function decompress_7z(data, password) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.decompress_7z(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}
exports.decompress_7z = decompress_7z;

/**
 * SDK download: decrypt + decompress bundle back to files.
 * Returns an array of {name, data} objects.
 * @param {Uint8Array} bundle
 * @param {string} password
 * @returns {any[]}
 */
function download(bundle, password) {
    const ptr0 = passArray8ToWasm0(bundle, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.download(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}
exports.download = download;

/**
 * Download raw data: verify + decrypt JSON-serialized bundle.
 * @param {string} bundle_json
 * @param {string} password
 * @returns {Uint8Array}
 */
function downloadData(bundle_json, password) {
    const ptr0 = passStringToWasm0(bundle_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.downloadData(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.downloadData = downloadData;

/**
 * SDK upload: compress files + encrypt in one call.
 * Returns a Uint8Array bundle containing encrypted data + crypto metadata.
 * @param {any[]} names
 * @param {Uint8Array[]} datas
 * @param {string} password
 * @returns {Uint8Array}
 */
function upload(names, datas, password) {
    const ptr0 = passArrayJsValueToWasm0(names, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(datas, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.upload(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.upload = upload;

/**
 * Upload raw data: encrypt with password-derived key, return JSON-serialized bundle.
 * @param {Uint8Array} data
 * @param {string} password
 * @returns {string}
 */
function uploadData(data, password) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.uploadData(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}
exports.uploadData = uploadData;

/**
 * Validate that the given bytes are a 7z archive.
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function validate_7z(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate_7z(ptr0, len0);
    return ret !== 0;
}
exports.validate_7z = validate_7z;

/**
 * Derive a key using Argon2id with explicit parameters.
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @param {number} memory_cost_kib
 * @param {number} hash_length
 * @returns {Uint8Array}
 */
function wasm_argon2_derive(password, salt, iterations, memory_cost_kib, hash_length) {
    const ptr0 = passArray8ToWasm0(password, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(salt, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_argon2_derive(ptr0, len0, ptr1, len1, iterations, memory_cost_kib, hash_length);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_argon2_derive = wasm_argon2_derive;

/**
 * @param {Uint8Array[]} records
 * @param {Uint8Array} key
 * @returns {Uint8Array[]}
 */
function wasm_decrypt_all(records, key) {
    const ptr0 = passArrayJsValueToWasm0(records, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_decrypt_all(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}
exports.wasm_decrypt_all = wasm_decrypt_all;

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @param {Uint8Array} nonce
 * @returns {Uint8Array}
 */
function wasm_decrypt_chunk(data, key, nonce) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(nonce, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_decrypt_chunk(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_decrypt_chunk = wasm_decrypt_chunk;

/**
 * Decrypt multiple chunks using AES-256-GCM.
 * @param {Uint8Array[]} chunks
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @returns {Uint8Array[]}
 */
function wasm_decrypt_chunks_parallel(chunks, key, base_iv) {
    const ptr0 = passArrayJsValueToWasm0(chunks, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_decrypt_chunks_parallel(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v4;
}
exports.wasm_decrypt_chunks_parallel = wasm_decrypt_chunks_parallel;

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
function wasm_decrypt_record(data, key) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_decrypt_record(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_decrypt_record = wasm_decrypt_record;

/**
 * Derive a 32-byte key from password and salt using Argon2id + HKDF.
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @returns {Uint8Array}
 */
function wasm_derive_key(password, salt) {
    const ptr0 = passArray8ToWasm0(password, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(salt, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_derive_key(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_derive_key = wasm_derive_key;

/**
 * @param {Uint8Array[]} records
 * @param {Uint8Array} key
 * @returns {Uint8Array[]}
 */
function wasm_encrypt_all(records, key) {
    const ptr0 = passArrayJsValueToWasm0(records, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_encrypt_all(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}
exports.wasm_encrypt_all = wasm_encrypt_all;

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @param {Uint8Array} nonce
 * @returns {Uint8Array}
 */
function wasm_encrypt_chunk(data, key, nonce) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(nonce, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_encrypt_chunk(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_encrypt_chunk = wasm_encrypt_chunk;

/**
 * Encrypt multiple chunks using AES-256-GCM.
 * In browser: uses Web Workers via wasm-bindgen-rayon if initialized.
 * In Node.js: uses sequential processing.
 * @param {Uint8Array[]} chunks
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @returns {Uint8Array[]}
 */
function wasm_encrypt_chunks_parallel(chunks, key, base_iv) {
    const ptr0 = passArrayJsValueToWasm0(chunks, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_encrypt_chunks_parallel(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v4 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v4;
}
exports.wasm_encrypt_chunks_parallel = wasm_encrypt_chunks_parallel;

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @returns {Uint8Array}
 */
function wasm_encrypt_record(data, key) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_encrypt_record(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.wasm_encrypt_record = wasm_encrypt_record;

/**
 * Generate a random 32-byte IKM.
 * @returns {Uint8Array}
 */
function wasm_generate_ikm() {
    const ret = wasm.wasm_generate_ikm();
    return ret;
}
exports.wasm_generate_ikm = wasm_generate_ikm;

/**
 * Generate a random secret (base64-encoded).
 * @returns {string}
 */
function wasm_generate_secret() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.wasm_generate_secret();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
exports.wasm_generate_secret = wasm_generate_secret;

/**
 * @param {Uint8Array} base_iv
 * @param {number} chunk_index
 * @returns {Uint8Array}
 */
function wasm_get_chunk_nonce(base_iv, chunk_index) {
    const ptr0 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wasm_get_chunk_nonce(ptr0, len0, chunk_index);
    return ret;
}
exports.wasm_get_chunk_nonce = wasm_get_chunk_nonce;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_is_function_acc5528be2b923f2: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_0beba4a1980d3eea: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_1fca8072260dd261: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_721f8decd50c87a3: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_71bb4348194e31f0: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_0e855b388e315e17: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_call_5575218572ead796: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_getRandomValues_cc7f052a444bb2ce: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_get_unchecked_54a4374c38e08460: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_length_589238bdcf171f0e: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_c6054974c0a6cdb9: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_2e117a478906f062: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_36e147a8ced3c6e0: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_from_slice_543b875b27789a8f: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_with_length_9b650f44b5c44a4e: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_d721637c7ca66eb8: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_f724b5db8acf89d2: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_set_0bf1fca872bc6d18: function(arg0, arg1, arg2) {
            arg0.set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbg_set_4564f7dc44fcb0c9: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_slice_c4a92de95dd6ffbc: function(arg0, arg1, arg2) {
            const ret = arg0.slice(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_THIS_2fee5048bcca5938: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_ce44e66a4935da8c: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_44f6e0cb5e67cdad: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_168f178805d978fe: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_b0e8ac4ed313fea8: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./wasm_bindings_bg.js": import0,
    };
}

const WasmKeychainFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmkeychain_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/wasm_bindings_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasmInstance = new WebAssembly.Instance(wasmModule, __wbg_get_imports());
let wasm = wasmInstance.exports;
wasm.__wbindgen_start();
