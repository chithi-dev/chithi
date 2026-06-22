use chithi_core::seven::{sdk_compress_and_encrypt, sdk_decrypt_and_decompress, SevenZBackend, SevenZDefault};
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

/// Validate that the given bytes are a 7z archive.
#[wasm_bindgen]
pub fn validate_7z(data: &[u8]) -> bool {
    SevenZDefault::validate(data)
}

/// Compress files into a 7z archive with optional AES-256 encryption.
#[wasm_bindgen]
pub fn compress_7z(
    names: Vec<JsValue>,
    datas: Vec<Uint8Array>,
    password: String,
) -> Result<Uint8Array, JsValue> {
    let pwd = if password.is_empty() { None } else { Some(password.as_str()) };

    let files: Vec<(String, Vec<u8>)> = names
        .into_iter()
        .zip(datas.into_iter())
        .map(|(name, data)| (name.as_string().unwrap_or_default(), data.to_vec()))
        .collect();

    let archive = SevenZDefault::compress(&files, pwd).map_err(|e| JsValue::from_str(&e))?;
    Ok(Uint8Array::from(&archive[..]))
}

/// Decompress a 7z archive with optional password.
/// Returns an array of {name, data} objects.
#[wasm_bindgen]
pub fn decompress_7z(
    data: &[u8],
    password: String,
) -> Result<Vec<JsValue>, JsValue> {
    let pwd = if password.is_empty() { None } else { Some(password.as_str()) };

    let entries = SevenZDefault::decompress(data, pwd).map_err(|e| JsValue::from_str(&e))?;

    let results = js_sys::Array::new();
    for (name, entry_data) in entries {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &JsValue::from_str("name"), &JsValue::from_str(&name))?;
        js_sys::Reflect::set(&obj, &JsValue::from_str("data"), &Uint8Array::from(&entry_data[..]).into())?;
        results.push(&obj);
    }
    Ok(results.iter().collect())
}

/// SDK upload: compress files + encrypt in one call.
/// Returns a Uint8Array bundle containing encrypted data + crypto metadata.
#[wasm_bindgen(js_name = "upload")]
pub fn wasm_upload(
    names: Vec<JsValue>,
    datas: Vec<Uint8Array>,
    password: String,
) -> Result<Uint8Array, JsValue> {
    if names.len() != datas.len() {
        return Err(JsValue::from_str("names and datas arrays must have the same length"));
    }
    if names.is_empty() {
        return Err(JsValue::from_str("At least one file is required"));
    }

    let files: Vec<(String, Vec<u8>)> = names
        .into_iter()
        .zip(datas.into_iter())
        .map(|(name, data)| (name.as_string().unwrap_or_default(), data.to_vec()))
        .collect();

    let pwd = if password.is_empty() { None } else { Some(password.as_str()) };
    let bundle = sdk_compress_and_encrypt(&files, pwd, None)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(Uint8Array::from(&bundle[..]))
}

/// SDK download: decrypt + decompress bundle back to files.
/// Returns an array of {name, data} objects.
#[wasm_bindgen(js_name = "download")]
pub fn wasm_download(
    bundle: &[u8],
    password: String,
) -> Result<Vec<JsValue>, JsValue> {
    let pwd = if password.is_empty() { None } else { Some(password.as_str()) };

    let entries = sdk_decrypt_and_decompress(bundle, pwd, None)
        .map_err(|e| JsValue::from_str(&e))?;

    let results = js_sys::Array::new();
    for (name, entry_data) in entries {
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &JsValue::from_str("name"), &JsValue::from_str(&name))?;
        js_sys::Reflect::set(&obj, &JsValue::from_str("data"), &Uint8Array::from(&entry_data[..]).into())?;
        results.push(&obj);
    }
    Ok(results.iter().collect())
}
