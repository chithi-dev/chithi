use chithi_core::send_crypto::{
    decrypt_all, decrypt_chunk, decrypt_chunks_parallel, decrypt_record,
    encrypt_all, encrypt_chunk, encrypt_chunks_parallel, encrypt_record,
    get_chunk_nonce, Keychain, sdk_upload, sdk_download,
    bundle_to_json, bundle_from_json,
};
use js_sys::Uint8Array;
use rand::rngs::OsRng;
use rand::RngCore;
use wasm_bindgen::prelude::*;

/// Generate a random secret (base64-encoded).
#[wasm_bindgen]
pub fn wasm_generate_secret() -> String {
    let kc = Keychain::new();
    kc.generate_secret()
}

/// Derive a 32-byte key from password and salt using Argon2id + HKDF.
#[wasm_bindgen]
pub fn wasm_derive_key(password: &[u8], salt: &[u8]) -> Result<Uint8Array, JsValue> {
    let key = chithi_core::send_crypto::derive_key(password, salt)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&key[..]))
}

/// Derive a key using Argon2id with explicit parameters.
#[wasm_bindgen]
pub fn wasm_argon2_derive(
    password: &[u8],
    salt: &[u8],
    iterations: u32,
    memory_cost_kib: u32,
    hash_length: usize,
) -> Result<Uint8Array, JsValue> {
    let mut out = vec![0u8; hash_length];
    argon2::Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(
            memory_cost_kib,
            iterations,
            1,
            Some(hash_length),
        ).map_err(|e| JsValue::from_str(&e.to_string()))?,
    ).hash_password_into(password, salt, &mut out)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(Uint8Array::from(&out[..]))
}

/// Generate a random 32-byte IKM.
#[wasm_bindgen]
pub fn wasm_generate_ikm() -> Uint8Array {
    let mut ikm = [0u8; 32];
    OsRng.fill_bytes(&mut ikm);
    Uint8Array::from(&ikm[..])
}

// --- Record encryption (AES-256-CBC) ---

#[wasm_bindgen]
pub fn wasm_encrypt_record(data: &[u8], key: &[u8]) -> Result<Uint8Array, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let result = encrypt_record(data, &key_arr).map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&result[..]))
}

#[wasm_bindgen]
pub fn wasm_decrypt_record(data: &[u8], key: &[u8]) -> Result<Uint8Array, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let result = decrypt_record(data, &key_arr).map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&result[..]))
}

// --- Chunk encryption (AES-256-GCM) ---

#[wasm_bindgen]
pub fn wasm_encrypt_chunk(data: &[u8], key: &[u8], nonce: &[u8]) -> Result<Uint8Array, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if nonce.len() != 12 {
        return Err(JsValue::from_str("Nonce must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let nonce_arr: [u8; 12] = nonce.try_into().unwrap();
    let result = encrypt_chunk(data, &key_arr, &nonce_arr).map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&result[..]))
}

#[wasm_bindgen]
pub fn wasm_decrypt_chunk(data: &[u8], key: &[u8], nonce: &[u8]) -> Result<Uint8Array, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if nonce.len() != 12 {
        return Err(JsValue::from_str("Nonce must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let nonce_arr: [u8; 12] = nonce.try_into().unwrap();
    let result = decrypt_chunk(data, &key_arr, &nonce_arr).map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&result[..]))
}

#[wasm_bindgen]
pub fn wasm_get_chunk_nonce(base_iv: &[u8], chunk_index: u32) -> Uint8Array {
    let base: [u8; 12] = base_iv.try_into()
        .map_err(|_| panic!("base_iv must be 12 bytes"))
        .unwrap();
    let nonce = get_chunk_nonce(&base, chunk_index);
    Uint8Array::from(&nonce[..])
}

// --- Batch chunk encryption (AES-256-GCM) ---

/// Encrypt multiple chunks using AES-256-GCM.
/// In browser: uses Web Workers via wasm-bindgen-rayon if initialized.
/// In Node.js: uses sequential processing.
#[wasm_bindgen]
pub fn wasm_encrypt_chunks_parallel(
    chunks: Vec<Uint8Array>,
    key: &[u8],
    base_iv: &[u8],
) -> Result<Vec<Uint8Array>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if base_iv.len() != 12 {
        return Err(JsValue::from_str("base_iv must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let base_iv_arr: [u8; 12] = base_iv.try_into().unwrap();
    let chunk_vecs: Vec<Vec<u8>> = chunks.into_iter().map(|c| c.to_vec()).collect();
    let results = encrypt_chunks_parallel(&chunk_vecs, &key_arr, &base_iv_arr)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(results.into_iter().map(|r| Uint8Array::from(&r[..])).collect())
}

/// Decrypt multiple chunks using AES-256-GCM.
#[wasm_bindgen]
pub fn wasm_decrypt_chunks_parallel(
    chunks: Vec<Uint8Array>,
    key: &[u8],
    base_iv: &[u8],
) -> Result<Vec<Uint8Array>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    if base_iv.len() != 12 {
        return Err(JsValue::from_str("base_iv must be 12 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let base_iv_arr: [u8; 12] = base_iv.try_into().unwrap();
    let chunk_vecs: Vec<Vec<u8>> = chunks.into_iter().map(|c| c.to_vec()).collect();
    let results = decrypt_chunks_parallel(&chunk_vecs, &key_arr, &base_iv_arr)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(results.into_iter().map(|r| Uint8Array::from(&r[..])).collect())
}

// --- Batch record encryption (AES-256-CBC) ---

#[wasm_bindgen]
pub fn wasm_encrypt_all(records: Vec<Uint8Array>, key: &[u8]) -> Result<Vec<Uint8Array>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let record_vecs: Vec<Vec<u8>> = records.into_iter().map(|r| r.to_vec()).collect();
    let results = encrypt_all(&record_vecs, &key_arr)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(results.into_iter().map(|r| Uint8Array::from(&r[..])).collect())
}

#[wasm_bindgen]
pub fn wasm_decrypt_all(records: Vec<Uint8Array>, key: &[u8]) -> Result<Vec<Uint8Array>, JsValue> {
    if key.len() != 32 {
        return Err(JsValue::from_str("Key must be 32 bytes"));
    }
    let key_arr: [u8; 32] = key.try_into().unwrap();
    let record_vecs: Vec<Vec<u8>> = records.into_iter().map(|r| r.to_vec()).collect();
    let results = decrypt_all(&record_vecs, &key_arr)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(results.into_iter().map(|r| Uint8Array::from(&r[..])).collect())
}

// --- SDK-level upload/download (raw data, no compression) ---

/// Upload raw data: encrypt with password-derived key, return JSON-serialized bundle.
#[wasm_bindgen(js_name = "uploadData")]
pub fn wasm_upload_data(data: &[u8], password: String) -> Result<String, JsValue> {
    if data.is_empty() {
        return Err(JsValue::from_str("Data must not be empty"));
    }
    if password.is_empty() {
        return Err(JsValue::from_str("Password must not be empty"));
    }

    let bundle = sdk_upload(data, &password)
        .map_err(|e| JsValue::from_str(&e))?;
    let json_bytes = bundle_to_json(&bundle)
        .map_err(|e| JsValue::from_str(&e))?;

    String::from_utf8(json_bytes)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Download raw data: verify + decrypt JSON-serialized bundle.
#[wasm_bindgen(js_name = "downloadData")]
pub fn wasm_download_data(bundle_json: String, password: String) -> Result<Uint8Array, JsValue> {
    let bundle = bundle_from_json(bundle_json.as_bytes())
        .map_err(|e| JsValue::from_str(&e))?;

    let decrypted = sdk_download(&bundle, &password)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(Uint8Array::from(&decrypted[..]))
}

// --- Keychain class ---

#[wasm_bindgen]
pub struct WasmKeychain {
    inner: Keychain,
}

#[wasm_bindgen]
impl WasmKeychain {
    /// Create a new keychain with random key material.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Keychain::new(),
        }
    }

    /// Create a keychain derived from a password.
    #[wasm_bindgen(js_name = "fromPassword")]
    pub fn from_password(password: String) -> Result<Self, JsValue> {
        let kc = Keychain::from_password(&password).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self { inner: kc })
    }

    /// Re-derive all keys from a new password.
    #[wasm_bindgen(js_name = "setPassword")]
    pub fn set_password(&mut self, password: String) -> Result<(), JsValue> {
        self.inner.set_password(&password).map_err(|e| JsValue::from_str(&e))
    }

    /// Generate a random shared secret (base64-encoded).
    #[wasm_bindgen(js_name = "generateSecret")]
    pub fn generate_secret(&self) -> String {
        self.inner.generate_secret()
    }

    /// Encrypt metadata using ChaCha20-Poly1305.
    #[wasm_bindgen(js_name = "encryptMetadata")]
    pub fn encrypt_metadata(&self, metadata: String) -> Result<Uint8Array, JsValue> {
        let result = self.inner.encrypt_metadata(&metadata).map_err(|e| JsValue::from_str(&e))?;
        Ok(Uint8Array::from(&result[..]))
    }

    /// Decrypt metadata using ChaCha20-Poly1305.
    #[wasm_bindgen(js_name = "decryptMetadata")]
    pub fn decrypt_metadata(&self, data: &[u8]) -> Result<String, JsValue> {
        let result = self.inner.decrypt_metadata(data).map_err(|e| JsValue::from_str(&e))?;
        Ok(result)
    }

    /// Sign data with Ed25519.
    #[wasm_bindgen]
    pub fn sign(&self, data: &[u8]) -> Uint8Array {
        let sig = self.inner.sign(data);
        Uint8Array::from(&sig[..])
    }

    /// Verify an Ed25519 signature.
    #[wasm_bindgen]
    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        self.inner.verify(data, signature)
    }

    /// Export the auth key (32 bytes).
    #[wasm_bindgen(js_name = "exportAuthKey")]
    pub fn export_auth_key(&self) -> Uint8Array {
        let key = self.inner.export_auth_key();
        Uint8Array::from(&key[..])
    }

    /// Get the salt (32 bytes).
    #[wasm_bindgen]
    pub fn salt(&self) -> Uint8Array {
        let s = self.inner.salt();
        Uint8Array::from(&s[..])
    }

    /// Get the initial keying material (32 bytes).
    #[wasm_bindgen]
    pub fn ikm(&self) -> Uint8Array {
        let i = self.inner.ikm();
        Uint8Array::from(&i[..])
    }
}
