use chacha20poly1305::aead::{Aead, KeyInit};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use ed25519_dalek::{Signer, SigningKey, Verifier};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

/// Thread-safe progress callback that only fires when subscribed.
/// Zero overhead when no listener registered.
pub struct ProgressCallback {
    /// Total bytes to process (used to compute percentage)
    total: usize,
    /// Atomic counter of bytes processed so far
    processed: AtomicUsize,
    /// Optional callback function — only called when Some
    callback: Mutex<Option<Box<dyn FnMut(usize, usize) + Send>>>,
}

impl ProgressCallback {
    /// Create with a callback — events will fire.
    pub fn new<F>(total: usize, callback: F) -> Self
    where
        F: FnMut(usize, usize) + Send + 'static,
    {
        Self {
            total,
            processed: AtomicUsize::new(0),
            callback: Mutex::new(Some(Box::new(callback))),
        }
    }

    /// Create without a callback — zero overhead, no events fire.
    pub fn noop(total: usize) -> Self {
        Self {
            total,
            processed: AtomicUsize::new(0),
            callback: Mutex::new(None),
        }
    }

    /// Whether a listener is subscribed.
    #[inline]
    pub fn has_listener(&self) -> bool {
        self.callback.lock().unwrap().is_some()
    }

    /// Report that `bytes` more data has been processed. Fires the callback.
    #[inline]
    pub fn report(&self, bytes: usize) {
        let new_total = self.processed.fetch_add(bytes, Ordering::Relaxed) + bytes;
        let clamped = if new_total > self.total {
            self.total
        } else {
            new_total
        };
        if let Some(ref mut cb) = *self.callback.lock().unwrap() {
            cb(clamped, self.total);
        }
    }

    /// Get current processed bytes (thread-safe snapshot).
    #[inline]
    pub fn processed(&self) -> usize {
        self.processed.load(Ordering::Relaxed)
    }

    #[inline]
    pub fn total(&self) -> usize {
        self.total
    }
}

/// Clone the Arc wrapper for sharing across parallel threads.
pub type Progress = Option<Arc<ProgressCallback>>;

// XChaCha20-Poly1305 is the only record format. Wire: nonce[24] || ciphertext[N+16_tag]

// Constants matching Firefox Send
pub const MAX_CONTENT_LENGTH: usize = 100 * 1024 * 1024;
pub const MAX_FILE_COUNT: usize = 100;
pub const MAX_METADATA_LENGTH: usize = 10 * 1024;
pub const MAX_EXPIRY_LENGTH: usize = 10;
pub const MAX_PASSWORD_LENGTH: usize = 100;
pub const MAX_DOWNLOADED_LENGTH: usize = 10;
pub const MAX_VISITS_LENGTH: usize = 10;
pub const KEY_DERIVATION_ITERATIONS: u32 = 8;
pub const KEY_DERIVATION_MEMORY: u32 = 64 * 1024;
pub const KEY_DERIVATION_PARALLELISM: u32 = 1;
pub const KEY_DERIVATION_LENGTH: usize = 32;
pub const NONCE_LENGTH: usize = 24;
pub const PAD_LIMIT: usize = 128;
pub const SALT_LENGTH: usize = 32;
pub const SIGNING_KEY_LENGTH: usize = 32;
pub const AUTH_KEY_LENGTH: usize = 32;
pub const PADDING: u8 = 0x9;
pub const CHUNK_SIZE: usize = 32 * 1024;

fn make_signing_key(seed: &[u8; 32]) -> SigningKey {
    let sk: ed25519_dalek::SecretKey = unsafe { core::mem::transmute_copy(seed) };
    SigningKey::from_bytes(&sk)
}

/// Key derivation using Argon2id followed by HKDF-SHA256
pub fn derive_key(password: &[u8], salt: &[u8]) -> Result<[u8; 32], String> {
    let mut argon2_key = [0u8; 32];
    argon2::Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(
            KEY_DERIVATION_MEMORY,
            KEY_DERIVATION_ITERATIONS,
            KEY_DERIVATION_PARALLELISM,
            Some(KEY_DERIVATION_LENGTH),
        ).map_err(|e| format!("Invalid argon2 params: {e}"))?,
    ).hash_password_into(password, salt, &mut argon2_key)
        .map_err(|e| format!("Argon2 error: {e}"))?;

    let (_prk, hkdf_instance) = hkdf::Hkdf::<sha2::Sha256>::extract(Some(salt), &argon2_key);
    let mut okm = [0u8; 32];
    hkdf_instance
        .expand(&[], &mut okm)
        .map_err(|_| "HKDF expand error".to_string())?;
    Ok(okm)
}

/// Metadata structure for encrypted uploads
#[derive(Debug, Clone)]
pub struct Metadata {
    pub filesize: u64,
    pub filename: String,
    pub filetype: String,
}

/// Core keychain that holds all crypto material
pub struct Keychain {
    ikm: [u8; 32],
    salt: [u8; SALT_LENGTH],
    secret: [u8; 32],
    signing_key: SigningKey,
    auth_key: [u8; AUTH_KEY_LENGTH],
}

impl Keychain {
    pub fn new() -> Self {
        let mut ikm = [0u8; 32];
        let mut salt = [0u8; SALT_LENGTH];
        OsRng.fill_bytes(&mut ikm);
        OsRng.fill_bytes(&mut salt);
        Self::from_raw(&ikm, &salt)
    }

    pub fn from_password(password: &str) -> Result<Self, String> {
        let mut salt = [0u8; SALT_LENGTH];
        OsRng.fill_bytes(&mut salt);
        let derived = derive_key(password.as_bytes(), &salt)?;
        let signing_key = make_signing_key(&derived);
        Ok(Self {
            ikm: derived,
            salt,
            secret: derived,
            signing_key,
            auth_key: derived,
        })
    }

    fn from_raw(ikm: &[u8; 32], salt: &[u8; SALT_LENGTH]) -> Self {
        let derived = derive_key(ikm, salt).unwrap_or([0u8; 32]);
        let signing_key = make_signing_key(&derived);

        Self {
            ikm: *ikm,
            salt: *salt,
            secret: derived,
            signing_key,
            auth_key: derived,
        }
    }

    pub fn generate_secret(&self) -> String {
        let mut secret_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut secret_bytes);
        B64.encode(secret_bytes)
    }

    pub fn encrypt_metadata(&self, metadata: &str) -> Result<Vec<u8>, String> {
        use chacha20poly1305::aead::{Aead, KeyInit};
        let cs = chacha20poly1305::XChaCha20Poly1305::new(&self.secret.into());
        let mut nonce_bytes = [0u8; NONCE_LENGTH];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = chacha20poly1305::XNonce::from_slice(&nonce_bytes);

        let ciphertext = cs
            .encrypt(nonce, metadata.as_bytes())
            .map_err(|e| format!("Encryption failed: {e}"))?;

        let mut result = Vec::with_capacity(NONCE_LENGTH + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    pub fn decrypt_metadata(&self, data: &[u8]) -> Result<String, String> {
        if data.len() < NONCE_LENGTH {
            return Err("Data too short for decryption".to_string());
        }

        let nonce_bytes = &data[..NONCE_LENGTH];
        let ciphertext = &data[NONCE_LENGTH..];

        use chacha20poly1305::aead::{Aead, KeyInit};
        let cs = chacha20poly1305::XChaCha20Poly1305::new(&self.secret.into());
        let nonce = chacha20poly1305::XNonce::from_slice(nonce_bytes);

        let plaintext = cs
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {e}"))?;

        String::from_utf8(plaintext)
            .map_err(|e| format!("Invalid UTF-8 in decrypted data: {e}"))
    }

    pub fn sign(&self, data: &[u8]) -> Vec<u8> {
        self.signing_key.sign(data).to_vec()
    }

    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        let vk = self.signing_key.verifying_key();
        let sig = match ed25519_dalek::Signature::from_slice(signature) {
            Ok(s) => s,
            Err(_) => return false,
        };
        vk.verify(data, &sig).is_ok()
    }

    pub fn set_password(&mut self, password: &str) -> Result<(), String> {
        let mut salt = [0u8; SALT_LENGTH];
        OsRng.fill_bytes(&mut salt);
        let derived = derive_key(password.as_bytes(), &salt)?;
        self.secret = derived;
        self.salt = salt;
        self.signing_key = make_signing_key(&derived);
        self.auth_key = derived;
        Ok(())
    }

    pub fn export_auth_key(&self) -> [u8; AUTH_KEY_LENGTH] {
        self.auth_key
    }

    pub fn salt(&self) -> [u8; SALT_LENGTH] {
        self.salt
    }

    pub fn ikm(&self) -> [u8; 32] {
        self.ikm
    }
}

/// Generate per-chunk nonce: base_iv with last 4 bytes XORed with chunk_index.
pub fn get_chunk_nonce(base_iv: &[u8; 24], chunk_index: u32) -> [u8; 24] {
    let mut nonce = *base_iv;
    let idx = u32::from_be_bytes([nonce[20], nonce[21], nonce[22], nonce[23]]) ^ chunk_index;
    nonce[20..24].copy_from_slice(&idx.to_be_bytes());
    nonce
}

/// Encrypt a single chunk using XChaCha20-Poly1305 with explicit 24-byte nonce.
pub fn encrypt_chunk(data: &[u8], key: &[u8; 32], nonce: &[u8; 24]) -> Result<Vec<u8>, String> {
    let cipher = chacha20poly1305::XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| "Invalid key length")?;
    let xnonce = chacha20poly1305::XNonce::from_slice(nonce);
    cipher.encrypt(xnonce, data)
        .map_err(|e| format!("XChaCha20 encryption failed: {e}"))
}

/// Decrypt a single chunk using XChaCha20-Poly1305 with explicit 24-byte nonce.
pub fn decrypt_chunk(data: &[u8], key: &[u8; 32], nonce: &[u8; 24]) -> Result<Vec<u8>, String> {
    let cipher = chacha20poly1305::XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| "Invalid key length")?;
    let xnonce = chacha20poly1305::XNonce::from_slice(nonce);
    cipher.decrypt(xnonce, data)
        .map_err(|e| format!("XChaCha20 decryption failed: {e}"))
}

// --- Parallel chunk encryption (wasm_thread) ---

/// Encrypt chunks in parallel, reporting progress when subscribed.
#[cfg(feature = "parallel")]
pub fn encrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<Vec<u8>>, String> {
    let key = *key;
    let base_iv = *base_iv;
    let chunks_owned: Vec<Vec<u8>> = chunks.to_vec();
    wasm_thread::scope(|s| {
        let handles: Vec<_> = chunks_owned
            .into_iter()
            .enumerate()
            .map(|(i, chunk)| {
                let prog = progress.clone();
                s.spawn(move || {
                    let result = encrypt_chunk(&chunk, &key, &get_chunk_nonce(&base_iv, i as u32));
                    if let Some(ref prog) = prog { prog.report(chunk.len()); }
                    result
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap_or_else(|e| panic!("{:?}", e))).collect()
    })
}

/// Decrypt chunks in parallel, reporting progress when subscribed.
#[cfg(feature = "parallel")]
pub fn decrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<Vec<u8>>, String> {
    let key = *key;
    let base_iv = *base_iv;
    let chunks_owned: Vec<Vec<u8>> = chunks.to_vec();
    wasm_thread::scope(|s| {
        let handles: Vec<_> = chunks_owned
            .into_iter()
            .enumerate()
            .map(|(i, chunk)| {
                let prog = progress.clone();
                s.spawn(move || {
                    let plaintext_len = if chunk.len() > 16 { chunk.len() - 16 } else { 0 };
                    let result = decrypt_chunk(&chunk, &key, &get_chunk_nonce(&base_iv, i as u32));
                    if let Some(ref prog) = prog { prog.report(plaintext_len); }
                    result
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap_or_else(|e| panic!("{:?}", e))).collect()
    })
}

// --- Sequential chunk fallback (no parallel feature) ---

/// Encrypt chunks sequentially, reporting progress when subscribed.
#[cfg(not(feature = "parallel"))]
pub fn encrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<Vec<u8>>, String> {
    chunks.iter()
        .enumerate()
        .map(|(i, chunk)| {
            let result = encrypt_chunk(chunk, key, &get_chunk_nonce(base_iv, i as u32));
            if let Some(ref prog) = progress { prog.report(chunk.len()); }
            result
        })
        .collect()
}

/// Decrypt chunks sequentially, reporting progress when subscribed.
#[cfg(not(feature = "parallel"))]
pub fn decrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<Vec<u8>>, String> {
    chunks.iter()
        .enumerate()
        .map(|(i, chunk)| {
            let plaintext_len = if chunk.len() > 16 { chunk.len() - 16 } else { 0 };
            let result = decrypt_chunk(chunk, key, &get_chunk_nonce(base_iv, i as u32));
            if let Some(ref prog) = progress { prog.report(plaintext_len); }
            result
        })
        .collect()
}

// --- Chunk splitting/joining ---

pub fn split_into_chunks(data: &[u8]) -> Vec<Vec<u8>> {
    data.chunks(CHUNK_SIZE)
        .map(|c| c.to_vec())
        .collect()
}

pub fn join_chunks(chunks: &[Vec<u8>]) -> Vec<u8> {
    let total_len: usize = chunks.iter().map(|c| c.len()).sum();
    let mut result = Vec::with_capacity(total_len);
    for chunk in chunks {
        result.extend_from_slice(chunk);
    }
    result
}

// --- End-to-end parallel encrypt/decrypt ---
// Encrypted chunks are larger than plaintext chunks (XChaCha20-Poly1305 adds 16-byte auth tag).
// Format: [num_chunks: u32 BE][chunk0_len: u32 BE][chunk0...][chunk1_len: u32 BE][chunk1...]...

pub fn parallel_encrypt_data(
    data: &[u8],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<u8>, String> {
    let chunks = split_into_chunks(data);
    let encrypted = encrypt_chunks_parallel(&chunks, key, base_iv, progress)?;

    let total: usize = 4 + encrypted.iter().map(|c| 4 + c.len()).sum::<usize>();
    let mut output = Vec::with_capacity(total);
    output.extend_from_slice(&(encrypted.len() as u32).to_be_bytes());
    for chunk in &encrypted {
        output.extend_from_slice(&(chunk.len() as u32).to_be_bytes());
        output.extend_from_slice(chunk);
    }
    Ok(output)
}

pub fn parallel_decrypt_data(
    data: &[u8],
    key: &[u8; 32],
    base_iv: &[u8; 24],
    progress: Progress,
) -> Result<Vec<u8>, String> {
    if data.len() < 4 {
        return Err("Encrypted data too short".to_string());
    }

    let num_chunks = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let mut offset = 4;
    let mut encrypted_chunks = Vec::with_capacity(num_chunks);

    for _ in 0..num_chunks {
        if offset + 4 > data.len() {
            return Err("Truncated chunk length header".to_string());
        }
        let chunk_len = u32::from_be_bytes([
            data[offset], data[offset + 1], data[offset + 2], data[offset + 3],
        ]) as usize;
        offset += 4;

        if offset + chunk_len > data.len() {
            return Err("Truncated chunk data".to_string());
        }
        encrypted_chunks.push(data[offset..offset + chunk_len].to_vec());
        offset += chunk_len;
    }

    let decrypted = decrypt_chunks_parallel(&encrypted_chunks, key, base_iv, progress)?;
    Ok(join_chunks(&decrypted))
}

// --- PKCS7 padding ---

/// Encrypt a single record using XChaCha20-Poly1305 with random 24-byte nonce.
/// Wire format: nonce[24] || ciphertext[N+16_tag]
pub fn encrypt_record(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let mut nonce = [0u8; 24];
    OsRng.fill_bytes(&mut nonce);

    let cipher = chacha20poly1305::XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| "Invalid key length")?;
    let xnonce = chacha20poly1305::XNonce::from_slice(&nonce);
    let ciphertext = cipher.encrypt(xnonce, data)
        .map_err(|e| format!("XChaCha20 record encryption failed: {e}"))?;

    let mut result = Vec::with_capacity(24 + ciphertext.len());
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Decrypt a single record using XChaCha20-Poly1305.
/// Wire format: nonce[24] || ciphertext[N+16_tag]
pub fn decrypt_record(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if data.len() < 24 {
        return Err("Record too short for decryption".to_string());
    }
    let cipher = chacha20poly1305::XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| "Invalid key length")?;
    let xnonce = chacha20poly1305::XNonce::from_slice(&data[..24]);
    cipher.decrypt(xnonce, &data[24..])
        .map_err(|e| format!("XChaCha20 record decryption failed: {e}"))
}

// --- Parallel record encryption ---

#[cfg(feature = "parallel")]
pub fn encrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    let key = *key;
    let records_owned: Vec<Vec<u8>> = records.to_vec();
    wasm_thread::scope(|s| {
        let handles: Vec<_> = records_owned
            .into_iter()
            .map(|record| {
                s.spawn(move || encrypt_record(&record, &key))
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap_or_else(|e| panic!("{:?}", e))).collect()
    })
}

#[cfg(feature = "parallel")]
pub fn decrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    let key = *key;
    let records_owned: Vec<Vec<u8>> = records.to_vec();
    wasm_thread::scope(|s| {
        let handles: Vec<_> = records_owned
            .into_iter()
            .map(|record| {
                s.spawn(move || decrypt_record(&record, &key))
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap_or_else(|e| panic!("{:?}", e))).collect()
    })
}

#[cfg(not(feature = "parallel"))]
pub fn encrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    records.iter()
        .map(|record| encrypt_record(record, key))
        .collect()
}

#[cfg(not(feature = "parallel"))]
pub fn decrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    records.iter()
        .map(|record| decrypt_record(record, key))
        .collect()
}

// --- SDK-level upload/download bundle ---

/// Serialized bundle produced by upload, consumed by download.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UploadBundle {
    pub salt: Vec<u8>,
    pub base_iv: Vec<u8>,
    pub encrypted_data: Vec<u8>,
    pub signature: Vec<u8>,
}

/// High-level upload: derive key from password, encrypt data in parallel chunks, sign.
pub fn sdk_upload(data: &[u8], password: &str, progress: Progress) -> Result<UploadBundle, String> {
    let keychain = Keychain::from_password(password)?;
    let key = keychain.export_auth_key();
    let salt = keychain.salt();
    let mut base_iv = [0u8; 24];
    OsRng.fill_bytes(&mut base_iv);

    let encrypted = parallel_encrypt_data(data, &key, &base_iv, progress)?;
    let signature = keychain.sign(&encrypted);

    Ok(UploadBundle {
        salt: salt.to_vec(),
        base_iv: base_iv.to_vec(),
        encrypted_data: encrypted,
        signature,
    })
}

/// High-level download: verify signature, derive key, decrypt data in parallel chunks.
pub fn sdk_download(bundle: &UploadBundle, password: &str, progress: Progress) -> Result<Vec<u8>, String> {
    if bundle.salt.len() != 32 {
        return Err("Invalid salt length".to_string());
    }
    if bundle.base_iv.len() != 24 {
        return Err("Invalid base_iv length".to_string());
    }

    let mut salt_arr = [0u8; 32];
    salt_arr.copy_from_slice(&bundle.salt);

    let mut base_iv_arr = [0u8; 24];
    base_iv_arr.copy_from_slice(&bundle.base_iv);

    let derived_key = derive_key(password.as_bytes(), &salt_arr)?;

    let sk: ed25519_dalek::SecretKey = unsafe { core::mem::transmute_copy(&derived_key) };
    let signing_key = SigningKey::from_bytes(&sk);
    let vk = signing_key.verifying_key();
    let sig = ed25519_dalek::Signature::from_slice(&bundle.signature)
        .map_err(|_| "Invalid signature format".to_string())?;
    vk.verify(&bundle.encrypted_data, &sig)
        .map_err(|_| "Signature verification failed".to_string())?;

    parallel_decrypt_data(&bundle.encrypted_data, &derived_key, &base_iv_arr, progress)
}

/// Serialize an UploadBundle to JSON bytes.
pub fn bundle_to_json(bundle: &UploadBundle) -> Result<Vec<u8>, String> {
    serde_json::to_vec(bundle)
        .map_err(|e| format!("Failed to serialize bundle: {e}"))
}

/// Deserialize an UploadBundle from JSON bytes.
pub fn bundle_from_json(data: &[u8]) -> Result<UploadBundle, String> {
    serde_json::from_slice(data)
        .map_err(|e| format!("Failed to deserialize bundle: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key() {
        let salt = [0u8; 32];
        let key = derive_key(b"test password", &salt).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_keychain_new() {
        let kc = Keychain::new();
        assert_eq!(kc.ikm().len(), 32);
    }

    #[test]
    fn test_keychain_from_password() {
        let kc = Keychain::from_password("test password").unwrap();
        assert_eq!(kc.salt().len(), 32);
    }

    #[test]
    fn test_encrypt_decrypt_metadata() {
        let kc = Keychain::new();
        let metadata = "{\"filename\":\"test.txt\",\"filesize\":1024}";
        let encrypted = kc.encrypt_metadata(metadata).unwrap();
        let decrypted = kc.decrypt_metadata(&encrypted).unwrap();
        assert_eq!(decrypted, metadata);
    }

    #[test]
    fn test_sign_verify() {
        let kc = Keychain::new();
        let data = b"test data";
        let sig = kc.sign(data);
        assert!(kc.verify(data, &sig));
        assert!(!kc.verify(b"other data", &sig));
    }

    #[test]
    fn test_encrypt_decrypt_record() {
        let key = [0u8; 32];
        let data = b"test record data";
        let encrypted = encrypt_record(data, &key).unwrap();
        let decrypted = decrypt_record(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

 
    #[test]
    fn test_encrypt_decrypt_chunk_xchacha() {
        let key = [0u8; 32];
        let nonce = [0u8; 24];
        let data = b"test chunk data for XChaCha20";
        let encrypted = encrypt_chunk(data, &key, &nonce).unwrap();
        let decrypted = decrypt_chunk(&encrypted, &key, &nonce).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_encrypt_decrypt_chunks_parallel() {
        let key = [0u8; 32];
        let base_iv = [0u8; 24];
        let chunks = vec![vec![1, 2, 3], vec![4, 5, 6], vec![7, 8, 9]];
        let encrypted = encrypt_chunks_parallel(&chunks, &key, &base_iv, None).unwrap();
        let decrypted = decrypt_chunks_parallel(&encrypted, &key, &base_iv, None).unwrap();
        assert_eq!(decrypted, chunks);
    }

    #[test]
    fn test_encrypt_decrypt_all() {
        let key = [0u8; 32];
        let records = vec![vec![1, 2, 3], vec![4, 5, 6], vec![7, 8, 9]];
        let encrypted = encrypt_all(&records, &key).unwrap();
        let decrypted = decrypt_all(&encrypted, &key).unwrap();
        assert_eq!(decrypted, records);
    }

    #[test]
    fn test_parallel_encrypt_decrypt_data() {
        let key = [0u8; 32];
        let base_iv = [0u8; 24];
        let data = vec![42u8; 100 * 1024];
        let encrypted = parallel_encrypt_data(&data, &key, &base_iv, None).unwrap();
        let decrypted = parallel_decrypt_data(&encrypted, &key, &base_iv, None).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_sdk_upload_download() {
        let original = b"Hello, this is sensitive data that needs encryption!";
        let password = "my_secure_password";

        let bundle = sdk_upload(original, password, None).unwrap();
        let decrypted = sdk_download(&bundle, password, None).unwrap();
        assert_eq!(decrypted, original);

        // Wrong password should fail
        let err = sdk_download(&bundle, "wrong_password", None);
        assert!(err.is_err());
    }

    #[test]
    fn test_sdk_upload_download_large() {
        let original = vec![42u8; 1 * 1024 * 1024]; // 1 MB
        let password = "test_password";

        let bundle = sdk_upload(&original, password, None).unwrap();
        let decrypted = sdk_download(&bundle, password, None).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_bundle_serialization() {
        let original = b"test data";
        let bundle = sdk_upload(original, "password", None).unwrap();
        let json = bundle_to_json(&bundle).unwrap();
        let restored = bundle_from_json(&json).unwrap();
        let decrypted = sdk_download(&restored, "password", None).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_progress_callback_fires() {
        let key = [0u8; 32];
        let base_iv = [0u8; 24];
        let data = vec![42u8; 100 * 1024];
        let reported = std::sync::Arc::new(std::sync::Mutex::new(0usize));
        let reported_clone = reported.clone();
        let callback = ProgressCallback::new(data.len(), move |processed, _total| {
            let mut val = reported_clone.lock().unwrap();
            *val = processed;
        });
        let progress = Some(std::sync::Arc::new(callback));
        let encrypted = parallel_encrypt_data(&data, &key, &base_iv, progress).unwrap();
        let decrypted = parallel_decrypt_data(&encrypted, &key, &base_iv, None).unwrap();
        assert_eq!(decrypted, data);
        assert_eq!(*reported.lock().unwrap(), data.len());
    }
}
