use aes::cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use aes::Aes256;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use ed25519_dalek::{Signer, SigningKey, Verifier};
use rand::rngs::OsRng;
use rand_core::RngCore;

type Aes256Cbc = cbc::Encryptor<Aes256>;
type Aes256CbcDec = cbc::Decryptor<Aes256>;

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
pub const NONCE_LENGTH: usize = 12;
pub const PAD_LIMIT: usize = 128;
pub const SALT_LENGTH: usize = 32;
pub const SIGNING_KEY_LENGTH: usize = 32;
pub const AUTH_KEY_LENGTH: usize = 32;
pub const PADDING: u8 = 0x9;

fn make_signing_key(seed: &[u8; 32]) -> SigningKey {
    // SecretKey is a newtype [u8; 32] — safe to transmute
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
    let okm_bytes = okm;
    Ok(okm_bytes)
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
    /// Generate a new keychain with random IKM
    pub fn new() -> Self {
        let mut ikm = [0u8; 32];
        let mut salt = [0u8; SALT_LENGTH];
        OsRng.fill_bytes(&mut ikm);
        OsRng.fill_bytes(&mut salt);
        Self::from_raw(&ikm, &salt)
    }

    /// Generate a new keychain from a password
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

    /// Create from raw IKM and salt
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

    /// Generate a shared secret
    pub fn generate_secret(&self) -> String {
        let mut secret_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut secret_bytes);
        B64.encode(secret_bytes)
    }

    /// Encrypt metadata using ChaCha20-Poly1305
    pub fn encrypt_metadata(&self, metadata: &str) -> Result<Vec<u8>, String> {
        use chacha20poly1305::aead::{Aead, KeyInit};
        let cs = chacha20poly1305::ChaCha20Poly1305::new(&self.secret.into());
        let mut nonce_bytes = [0u8; NONCE_LENGTH];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);

        let ciphertext = cs
            .encrypt(nonce, metadata.as_bytes())
            .map_err(|e| format!("Encryption failed: {e}"))?;

        let mut result = Vec::with_capacity(NONCE_LENGTH + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    /// Decrypt metadata using ChaCha20-Poly1305
    pub fn decrypt_metadata(&self, data: &[u8]) -> Result<String, String> {
        if data.len() < NONCE_LENGTH {
            return Err("Data too short for decryption".to_string());
        }

        let nonce_bytes = &data[..NONCE_LENGTH];
        let ciphertext = &data[NONCE_LENGTH..];

        use chacha20poly1305::aead::{Aead, KeyInit};
        let cs = chacha20poly1305::ChaCha20Poly1305::new(&self.secret.into());
        let nonce = chacha20poly1305::Nonce::from_slice(nonce_bytes);

        let plaintext = cs
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {e}"))?;

        String::from_utf8(plaintext)
            .map_err(|e| format!("Invalid UTF-8 in decrypted data: {e}"))
    }

    /// Sign data
    pub fn sign(&self, data: &[u8]) -> Vec<u8> {
        self.signing_key.sign(data).to_vec()
    }

    /// Verify a signature
    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        let vk = self.signing_key.verifying_key();
        let sig = match ed25519_dalek::Signature::from_slice(signature) {
            Ok(s) => s,
            Err(_) => return false,
        };
        vk.verify(data, &sig).is_ok()
    }

    /// Set a password and re-derive keys
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

    /// Export the auth key
    pub fn export_auth_key(&self) -> [u8; AUTH_KEY_LENGTH] {
        self.auth_key
    }

    /// Get the salt
    pub fn salt(&self) -> [u8; SALT_LENGTH] {
        self.salt
    }

    /// Get the IKM
    pub fn ikm(&self) -> [u8; 32] {
        self.ikm
    }
}

/// Generate per-chunk nonce: base_iv with last 4 bytes XORed with chunk_index.
/// Matches the frontend getChunkIv function exactly.
pub fn get_chunk_nonce(base_iv: &[u8; 12], chunk_index: u32) -> [u8; 12] {
    let mut nonce = *base_iv;
    let idx = u32::from_be_bytes([nonce[8], nonce[9], nonce[10], nonce[11]]) ^ chunk_index;
    nonce[8..12].copy_from_slice(&idx.to_be_bytes());
    nonce
}

/// Encrypt a single chunk using AES-256-GCM with explicit 12-byte nonce.
/// Returns ciphertext || 16-byte auth tag (standard GCM format).
pub fn encrypt_chunk(data: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Result<Vec<u8>, String> {
    use aes_gcm::aead::{Aead, KeyInit};
    let cipher = aes_gcm::Aes256Gcm::new_from_slice(key)
        .map_err(|_| "Invalid AES key length")?;
    let gcm_nonce = aes_gcm::Nonce::from_slice(nonce);
    cipher.encrypt(gcm_nonce, data)
        .map_err(|e| format!("GCM encryption failed: {e}"))
}

/// Decrypt a single chunk using AES-256-GCM with explicit 12-byte nonce.
/// Input must be ciphertext || 16-byte auth tag.
pub fn decrypt_chunk(data: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Result<Vec<u8>, String> {
    use aes_gcm::aead::{Aead, KeyInit};
    let cipher = aes_gcm::Aes256Gcm::new_from_slice(key)
        .map_err(|_| "Invalid AES key length")?;
    let gcm_nonce = aes_gcm::Nonce::from_slice(nonce);
    cipher.decrypt(gcm_nonce, data)
        .map_err(|e| format!("GCM decryption failed: {e}"))
}

/// Encrypt all chunks in parallel using Rayon
#[cfg(feature = "rayon")]
pub fn encrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 12],
) -> Result<Vec<Vec<u8>>, String> {
    use rayon::prelude::*;
    chunks.par_iter()
        .enumerate()
        .map(|(i, chunk)| {
            let nonce = get_chunk_nonce(base_iv, i as u32);
            encrypt_chunk(chunk, key, &nonce)
        })
        .collect()
}

/// Decrypt all chunks in parallel using Rayon
#[cfg(feature = "rayon")]
pub fn decrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 12],
) -> Result<Vec<Vec<u8>>, String> {
    use rayon::prelude::*;
    chunks.par_iter()
        .enumerate()
        .map(|(i, chunk)| {
            let nonce = get_chunk_nonce(base_iv, i as u32);
            decrypt_chunk(chunk, key, &nonce)
        })
        .collect()
}

/// Encrypt all chunks sequentially (no Rayon)
#[cfg(not(feature = "rayon"))]
pub fn encrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 12],
) -> Result<Vec<Vec<u8>>, String> {
    chunks.iter()
        .enumerate()
        .map(|(i, chunk)| {
            let nonce = get_chunk_nonce(base_iv, i as u32);
            encrypt_chunk(chunk, key, &nonce)
        })
        .collect()
}

/// Decrypt all chunks sequentially (no Rayon)
#[cfg(not(feature = "rayon"))]
pub fn decrypt_chunks_parallel(
    chunks: &[Vec<u8>],
    key: &[u8; 32],
    base_iv: &[u8; 12],
) -> Result<Vec<Vec<u8>>, String> {
    chunks.iter()
        .enumerate()
        .map(|(i, chunk)| {
            let nonce = get_chunk_nonce(base_iv, i as u32);
            decrypt_chunk(chunk, key, &nonce)
        })
        .collect()
}

/// Pad data to AES block size (16 bytes) using PKCS7
fn pad_data(data: &[u8]) -> Vec<u8> {
    let block_size = 16;
    let remainder = data.len() % block_size;
    let padding_len = if remainder == 0 { block_size } else { block_size - remainder };

    let mut padded = data.to_vec();
    padded.extend_from_slice(&vec![padding_len as u8; padding_len]);
    padded
}

/// Remove PKCS7 padding
fn unpad_data(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.is_empty() {
        return Err("Empty data cannot be unpadded".to_string());
    }
    let padding_len = *data.last().unwrap() as usize;
    if padding_len == 0 || padding_len > 16 || padding_len > data.len() {
        return Err("Invalid padding".to_string());
    }

    for i in (data.len() - padding_len)..data.len() {
        if data[i] != padding_len as u8 {
            return Err("Invalid padding bytes".to_string());
        }
    }

    Ok(data[..data.len() - padding_len].to_vec())
}

/// Encrypt a single record using AES-256-CBC with random IV
pub fn encrypt_record(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let mut iv = [0u8; 16];
    OsRng.fill_bytes(&mut iv);

    let mut cipher = Aes256Cbc::new_from_slices(key, &iv)
        .map_err(|_| "Invalid AES key or IV length")?;

    let padded = pad_data(data);
    let mut ciphertext = padded.clone();

    for chunk in ciphertext.chunks_mut(16) {
        cipher.encrypt_block_mut(chunk.into());
    }

    let mut result = Vec::with_capacity(16 + ciphertext.len());
    result.extend_from_slice(&iv);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Decrypt a single record using AES-256-CBC
pub fn decrypt_record(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if data.len() < 16 {
        return Err("Data too short for decryption".to_string());
    }

    let iv = &data[..16];
    let ciphertext = &data[16..];

    let mut cipher = Aes256CbcDec::new_from_slices(key, iv)
        .map_err(|_| "Invalid AES key or IV length")?;

    let mut decrypted = ciphertext.to_vec();
    for chunk in decrypted.chunks_mut(16) {
        cipher.decrypt_block_mut(chunk.into());
    }

    unpad_data(&decrypted)
}

/// Encrypt all records in parallel using Rayon
#[cfg(feature = "rayon")]
pub fn encrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    use rayon::prelude::*;
    records.par_iter()
        .map(|record| encrypt_record(record, key))
        .collect()
}

/// Decrypt all records in parallel using Rayon
#[cfg(feature = "rayon")]
pub fn decrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    use rayon::prelude::*;
    records.par_iter()
        .map(|record| decrypt_record(record, key))
        .collect()
}

/// Encrypt all records sequentially (no Rayon)
#[cfg(not(feature = "rayon"))]
pub fn encrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    records.iter()
        .map(|record| encrypt_record(record, key))
        .collect()
}

/// Decrypt all records sequentially (no Rayon)
#[cfg(not(feature = "rayon"))]
pub fn decrypt_all(records: &[Vec<u8>], key: &[u8; 32]) -> Result<Vec<Vec<u8>>, String> {
    records.iter()
        .map(|record| decrypt_record(record, key))
        .collect()
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
    fn test_pad_unpad() {
        let data = b"hello world";
        let padded = pad_data(data);
        assert_eq!(padded.len() % 16, 0);
        let unpadded = unpad_data(&padded).unwrap();
        assert_eq!(unpadded, data);
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
    fn test_get_chunk_nonce() {
        let base_iv = [0u8; 12];
        let nonce0 = get_chunk_nonce(&base_iv, 0);
        let nonce1 = get_chunk_nonce(&base_iv, 1);
        let nonce5 = get_chunk_nonce(&base_iv, 5);

        // XOR with 0 should be identity
        assert_eq!(nonce0, base_iv);
        // XOR with 1 should flip last byte
        assert_eq!(nonce1[11], 1);
        // XOR with 5
        assert_eq!(nonce5[11], 5);
        // All nonces should be different
        assert_ne!(nonce0, nonce1);
        assert_ne!(nonce1, nonce5);
    }

    #[test]
    fn test_encrypt_decrypt_chunk_gcm() {
        let key = [0u8; 32];
        let nonce = [0u8; 12];
        let data = b"test chunk data for GCM";
        let encrypted = encrypt_chunk(data, &key, &nonce).unwrap();
        let decrypted = decrypt_chunk(&encrypted, &key, &nonce).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn test_encrypt_decrypt_chunk_empty() {
        let key = [0u8; 32];
        let nonce = [0u8; 12];
        let empty: &[u8] = &[];
        let encrypted = encrypt_chunk(empty, &key, &nonce).unwrap();
        // GCM on empty data produces a 16-byte auth tag
        assert_eq!(encrypted.len(), 16);
        let decrypted = decrypt_chunk(&encrypted, &key, &nonce).unwrap();
        assert_eq!(decrypted, empty);
    }

    #[test]
    fn test_encrypt_decrypt_chunks_parallel() {
        let key = [0u8; 32];
        let base_iv = [0u8; 12];
        let chunks = vec![
            vec![1, 2, 3],
            vec![4, 5, 6],
            vec![7, 8, 9],
        ];
        let encrypted = encrypt_chunks_parallel(&chunks, &key, &base_iv).unwrap();
        let decrypted = decrypt_chunks_parallel(&encrypted, &key, &base_iv).unwrap();
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
}
