use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::sync::Arc;

use chithi_core::chithi_cryto::{
    decrypt_all, decrypt_chunk, decrypt_chunks_parallel, decrypt_record,
    encrypt_all, encrypt_chunk, encrypt_chunks_parallel, encrypt_record,
    get_chunk_nonce, Keychain, parallel_decrypt_data, parallel_encrypt_data,
    sdk_upload, sdk_download, bundle_to_json, bundle_from_json,
    ProgressCallback,
};
use rand::rngs::OsRng;
use rand::RngCore;

use crate::{read_slice, write_slice, write_out_len, read_chunk_array, write_chunk_array};

// ---------------------------------------------------------------------------
// Linear memory allocator (simple bump pointer)
// ---------------------------------------------------------------------------

static HEAP_PTR: AtomicU32 = AtomicU32::new(0x10000);

#[unsafe(no_mangle)]
pub extern "C" fn chithi_alloc(len: u32) -> u32 {
    HEAP_PTR.fetch_add(len, Ordering::Relaxed)
}

#[unsafe(no_mangle)]
pub extern "C" fn chithi_dealloc(_ptr: u32, _len: u32) {
    // Bump allocator — no-op free. Memory reclaimed on module reload.
}

#[unsafe(no_mangle)]
pub extern "C" fn chithi_reset_heap() {
    HEAP_PTR.store(0x10000, Ordering::Relaxed);
}

// ---------------------------------------------------------------------------
// Multi-core detection
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn chithi_available_parallelism() -> u32 {
    std::thread::available_parallelism()
        .map(|n| n.get() as u32)
        .unwrap_or(1)
}

// ---------------------------------------------------------------------------
// Event-driven progress callback bridge
//
// JS registers a callback: fn(progress: u32, total: u32, user_data: u32)
// user_data is passed through unchanged so JS can carry context.
// Pass callback_ptr = 0 to disable progress events.
// ---------------------------------------------------------------------------

type ProgressFn = unsafe extern "C" fn(processed: u32, total: u32, user_data: usize);

struct CallbackBridge {
    fn_ptr: ProgressFn,
    user_data: usize,
}

impl CallbackBridge {
    fn new(fn_ptr: usize, user_data: usize) -> Option<Self> {
        if fn_ptr == 0 {
            None
        } else {
            Some(Self {
                fn_ptr: unsafe { std::mem::transmute(fn_ptr) },
                user_data,
            })
        }
    }

    fn fire(&self, processed: usize, total: usize) {
        unsafe {
            (self.fn_ptr)(
                processed.min(u32::MAX as usize) as u32,
                total.min(u32::MAX as usize) as u32,
                self.user_data,
            );
        }
    }

    fn into_progress(&self, total: usize) -> Option<Arc<ProgressCallback>> {
        let bridge = self.clone();
        Some(Arc::new(ProgressCallback::new(total, move |processed, _total| {
            bridge.fire(processed, _total);
        })))
    }
}

impl Clone for CallbackBridge {
    fn clone(&self) -> Self {
        Self {
            fn_ptr: self.fn_ptr,
            user_data: self.user_data,
        }
    }
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_derive_key(
    password_ptr: u32,
    password_len: u32,
    salt_ptr: u32,
    salt_len: u32,
    out_ptr: u32,
) -> i32 {
    let password = read_slice(password_ptr, password_len);
    let salt = read_slice(salt_ptr, salt_len);

    match chithi_core::chithi_cryto::derive_key(password, salt) {
        Ok(key) => {
            write_slice(out_ptr, &key);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_argon2_derive(
    password_ptr: u32,
    password_len: u32,
    salt_ptr: u32,
    salt_len: u32,
    iterations: u32,
    memory_cost_kib: u32,
    hash_length: u32,
    out_ptr: u32,
) -> i32 {
    let password = read_slice(password_ptr, password_len);
    let salt = read_slice(salt_ptr, salt_len);

    let params = match argon2::Params::new(memory_cost_kib, iterations, 1, Some(hash_length as usize)) {
        Ok(p) => p,
        Err(_) => return -2,
    };
    let mut out = vec![0u8; hash_length as usize];
    match argon2::Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        params,
    ).hash_password_into(password, salt, &mut out) {
        Ok(()) => {
            write_slice(out_ptr, &out);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_generate_secret(out_ptr: u32, out_len: u32) -> i32 {
    let kc = Keychain::new();
    let secret = kc.generate_secret();
    let bytes = secret.as_bytes();
    if bytes.len() > out_len as usize {
        return -1;
    }
    write_slice(out_ptr, bytes);
    bytes.len() as i32
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_generate_ikm(out_ptr: u32) -> i32 {
    let mut ikm = [0u8; 32];
    OsRng.fill_bytes(&mut ikm);
    write_slice(out_ptr, &ikm);
    0
}

// ---------------------------------------------------------------------------
// Record encryption (XChaCha20-Poly1305)
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_encrypt_record(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();

    match encrypt_record(data, &key_arr) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_decrypt_record(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();

    match decrypt_record(data, &key_arr) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

// ---------------------------------------------------------------------------
// Chunk encryption (XChaCha20-Poly1305)
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_encrypt_chunk(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    nonce_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let nonce_arr: [u8; 24] = read_slice(nonce_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    match encrypt_chunk(data, &key_arr, &nonce_arr) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_decrypt_chunk(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    nonce_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let nonce_arr: [u8; 24] = read_slice(nonce_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    match decrypt_chunk(data, &key_arr, &nonce_arr) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_get_chunk_nonce(
    base_iv_ptr: u32,
    chunk_index: u32,
    out_ptr: u32,
) -> i32 {
    let base: [u8; 24] = read_slice(base_iv_ptr, 24).try_into().map_err(|_| -1i32).unwrap();
    let nonce = get_chunk_nonce(&base, chunk_index);
    write_slice(out_ptr, &nonce);
    0
}

// ---------------------------------------------------------------------------
// Batch chunk encryption — event-driven progress
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_encrypt_chunks_parallel(
    input_ptr: u32,
    input_len: u32,
    key_ptr: u32,
    base_iv_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let chunks = match read_chunk_array(input) { Ok(c) => c, Err(e) => return e };
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let iv_arr: [u8; 24] = read_slice(base_iv_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    let total: usize = chunks.iter().map(|c| c.len()).sum();
    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(total));

    match encrypt_chunks_parallel(&chunks, &key_arr, &iv_arr, progress) {
        Ok(results) => {
            let mut out_buf = Vec::new();
            write_chunk_array(&mut out_buf, &results);
            write_slice(out_ptr, &out_buf);
            write_out_len(out_len_ptr, out_buf.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_decrypt_chunks_parallel(
    input_ptr: u32,
    input_len: u32,
    key_ptr: u32,
    base_iv_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let chunks = match read_chunk_array(input) { Ok(c) => c, Err(e) => return e };
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let iv_arr: [u8; 24] = read_slice(base_iv_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    // Estimate total plaintext: each encrypted chunk is plaintext + 16-byte tag
    let total: usize = chunks.iter().map(|c| if c.len() > 16 { c.len() - 16 } else { 0 }).sum();
    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(total));

    match decrypt_chunks_parallel(&chunks, &key_arr, &iv_arr, progress) {
        Ok(results) => {
            let mut out_buf = Vec::new();
            write_chunk_array(&mut out_buf, &results);
            write_slice(out_ptr, &out_buf);
            write_out_len(out_len_ptr, out_buf.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

// ---------------------------------------------------------------------------
// Batch record encryption (XChaCha20-Poly1305)
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_encrypt_all(
    input_ptr: u32,
    input_len: u32,
    key_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let records = match read_chunk_array(input) { Ok(c) => c, Err(e) => return e };
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();

    match encrypt_all(&records, &key_arr) {
        Ok(results) => {
            let mut out_buf = Vec::new();
            write_chunk_array(&mut out_buf, &results);
            write_slice(out_ptr, &out_buf);
            write_out_len(out_len_ptr, out_buf.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_decrypt_all(
    input_ptr: u32,
    input_len: u32,
    key_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let records = match read_chunk_array(input) { Ok(c) => c, Err(e) => return e };
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();

    match decrypt_all(&records, &key_arr) {
        Ok(results) => {
            let mut out_buf = Vec::new();
            write_chunk_array(&mut out_buf, &results);
            write_slice(out_ptr, &out_buf);
            write_out_len(out_len_ptr, out_buf.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

// ---------------------------------------------------------------------------
// End-to-end parallel encrypt/decrypt (single data buffer) — event-driven
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_parallel_encrypt_data(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    base_iv_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let iv_arr: [u8; 24] = read_slice(base_iv_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(data.len()));

    match parallel_encrypt_data(data, &key_arr, &iv_arr, progress) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_parallel_decrypt_data(
    data_ptr: u32,
    data_len: u32,
    key_ptr: u32,
    base_iv_ptr: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let key_arr: [u8; 32] = read_slice(key_ptr, 32).try_into().map_err(|_| -1i32).unwrap();
    let iv_arr: [u8; 24] = read_slice(base_iv_ptr, 24).try_into().map_err(|_| -2i32).unwrap();

    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(data.len()));

    match parallel_decrypt_data(data, &key_arr, &iv_arr, progress) {
        Ok(result) => {
            write_slice(out_ptr, &result);
            write_out_len(out_len_ptr, result.len() as u32);
            0
        }
        Err(_) => -1,
    }
}

// ---------------------------------------------------------------------------
// SDK-level upload/download (raw data, no compression) — event-driven
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_upload_data(
    data_ptr: u32,
    data_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let data = read_slice(data_ptr, data_len);
    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(data.len()));

    let bundle = match sdk_upload(data, password, progress) {
        Ok(b) => b,
        Err(_) => return -2,
    };
    let json_bytes = match bundle_to_json(&bundle) {
        Ok(b) => b,
        Err(_) => return -3,
    };

    write_slice(out_ptr, &json_bytes);
    write_out_len(out_len_ptr, json_bytes.len() as u32);
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_download_data(
    bundle_json_ptr: u32,
    bundle_json_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let json_bytes = read_slice(bundle_json_ptr, bundle_json_len);
    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let bundle = match bundle_from_json(json_bytes) {
        Ok(b) => b,
        Err(_) => return -2,
    };

    // Estimate total from encrypted data length
    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(bundle.encrypted_data.len()));

    let decrypted = match sdk_download(&bundle, password, progress) {
        Ok(d) => d,
        Err(_) => return -3,
    };

    write_slice(out_ptr, &decrypted);
    write_out_len(out_len_ptr, decrypted.len() as u32);
    0
}

// ---------------------------------------------------------------------------
// Keychain — opaque handle (u32 pointer into WASM heap)
// ---------------------------------------------------------------------------

static KEYCHAIN_STORE: Mutex<Option<Keychain>> = Mutex::new(None);
static KEYCHAIN_HANDLE: AtomicU32 = AtomicU32::new(0);

#[unsafe(no_mangle)]
pub extern "C" fn keychain_new() -> u32 {
    let kc = Keychain::new();
    let ptr = chithi_alloc(1);
    *KEYCHAIN_STORE.lock().unwrap() = Some(kc);
    KEYCHAIN_HANDLE.store(ptr, Ordering::Relaxed);
    ptr
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_from_password(handle: u32, password_ptr: u32, password_len: u32) -> i32 {
    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    match Keychain::from_password(password) {
        Ok(kc) => {
            *KEYCHAIN_STORE.lock().unwrap() = Some(kc);
            KEYCHAIN_HANDLE.store(handle, Ordering::Relaxed);
            0
        }
        Err(_) => -1,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_drop(handle: u32) {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) == handle {
        KEYCHAIN_STORE.lock().unwrap().take();
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_set_password(handle: u32, password_ptr: u32, password_len: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) => s,
        Err(_) => return -2,
    };
    let mut store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref mut kc) = *store {
        match kc.set_password(password) {
            Ok(()) => 0,
            Err(_) => -1,
        }
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_generate_secret(handle: u32, out_ptr: u32, out_len: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        let secret = kc.generate_secret();
        let bytes = secret.as_bytes();
        if bytes.len() > out_len as usize { return -2; }
        write_slice(out_ptr, bytes);
        0
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_encrypt_metadata(
    handle: u32,
    data_ptr: u32,
    data_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let metadata = match std::str::from_utf8(read_slice(data_ptr, data_len)) {
        Ok(s) => s,
        Err(_) => return -2,
    };
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        match kc.encrypt_metadata(metadata) {
            Ok(result) => {
                write_slice(out_ptr, &result);
                write_out_len(out_len_ptr, result.len() as u32);
                0
            }
            Err(_) => -1,
        }
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_decrypt_metadata(
    handle: u32,
    data_ptr: u32,
    data_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let data = read_slice(data_ptr, data_len);
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        match kc.decrypt_metadata(data) {
            Ok(result) => {
                let bytes = result.as_bytes();
                write_slice(out_ptr, bytes);
                write_out_len(out_len_ptr, bytes.len() as u32);
                0
            }
            Err(_) => -1,
        }
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_sign(handle: u32, data_ptr: u32, data_len: u32, out_ptr: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let data = read_slice(data_ptr, data_len);
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        let sig = kc.sign(data);
        write_slice(out_ptr, &sig);
        0
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_verify(
    handle: u32,
    data_ptr: u32,
    data_len: u32,
    sig_ptr: u32,
    sig_len: u32,
) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let data = read_slice(data_ptr, data_len);
    let sig = read_slice(sig_ptr, sig_len);
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        if kc.verify(data, sig) { 1 } else { 0 }
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_export_auth_key(handle: u32, out_ptr: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        let key = kc.export_auth_key();
        write_slice(out_ptr, &key);
        0
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_salt(handle: u32, out_ptr: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        let s = kc.salt();
        write_slice(out_ptr, &s);
        0
    } else {
        -1
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn keychain_ikm(handle: u32, out_ptr: u32) -> i32 {
    if KEYCHAIN_HANDLE.load(Ordering::Relaxed) != handle { return -1; }
    let store = KEYCHAIN_STORE.lock().unwrap();
    if let Some(ref kc) = *store {
        let i = kc.ikm();
        write_slice(out_ptr, &i);
        0
    } else {
        -1
    }
}
