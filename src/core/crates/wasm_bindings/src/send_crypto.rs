use chithi_core::send_crypto::{Keychain, decrypt_chunk, decrypt_record, encrypt_chunk, encrypt_record, get_chunk_nonce};
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wasm_generate_secret() -> String {
    let kc = Keychain::new();
    kc.generate_secret()
}

#[wasm_bindgen]
pub fn wasm_derive_key(password: &[u8], salt: &[u8]) -> Result<Uint8Array, JsValue> {
    let key = chithi_core::send_crypto::derive_key(password, salt)
        .map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&key[..]))
}

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

#[wasm_bindgen]
pub struct WasmKeychain {
    inner: Keychain,
}

#[wasm_bindgen]
impl WasmKeychain {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Keychain::new(),
        }
    }

    #[wasm_bindgen(js_name = "fromPassword")]
    pub fn from_password(password: String) -> Result<Self, JsValue> {
        let kc = Keychain::from_password(&password).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self { inner: kc })
    }

    #[wasm_bindgen(js_name = "setPassword")]
    pub fn set_password(&mut self, password: String) -> Result<(), JsValue> {
        self.inner.set_password(&password).map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen(js_name = "generateSecret")]
    pub fn generate_secret(&self) -> String {
        self.inner.generate_secret()
    }

    #[wasm_bindgen(js_name = "encryptMetadata")]
    pub fn encrypt_metadata(&self, metadata: String) -> Result<Uint8Array, JsValue> {
        let result = self.inner.encrypt_metadata(&metadata).map_err(|e| JsValue::from_str(&e))?;
        Ok(Uint8Array::from(&result[..]))
    }

    #[wasm_bindgen(js_name = "decryptMetadata")]
    pub fn decrypt_metadata(&self, data: &[u8]) -> Result<String, JsValue> {
        let result = self.inner.decrypt_metadata(data).map_err(|e| JsValue::from_str(&e))?;
        Ok(result)
    }

    #[wasm_bindgen]
    pub fn sign(&self, data: &[u8]) -> Uint8Array {
        let sig = self.inner.sign(data);
        Uint8Array::from(&sig[..])
    }

    #[wasm_bindgen]
    pub fn verify(&self, data: &[u8], signature: &[u8]) -> bool {
        self.inner.verify(data, signature)
    }

    #[wasm_bindgen(js_name = "exportAuthKey")]
    pub fn export_auth_key(&self) -> Uint8Array {
        let key = self.inner.export_auth_key();
        Uint8Array::from(&key[..])
    }

    #[wasm_bindgen]
    pub fn salt(&self) -> Uint8Array {
        let s = self.inner.salt();
        Uint8Array::from(&s[..])
    }

    #[wasm_bindgen]
    pub fn ikm(&self) -> Uint8Array {
        let i = self.inner.ikm();
        Uint8Array::from(&i[..])
    }
}
