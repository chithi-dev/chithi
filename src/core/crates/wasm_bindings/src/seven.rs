use chithi_core::seven::{SevenZBackend, SevenZDefault};
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

/// Decompress a 7z archive with optional password for encrypted archives.
/// Calls the callback for each entry with (name, data, type).
#[wasm_bindgen]
pub fn decompress_7z(
    data: &[u8],
    password: String,
    callback: &js_sys::Function,
) -> Result<(), JsValue> {
    let pwd = if password.is_empty() { None } else { Some(password.as_str()) };

    let entries = SevenZDefault::decompress(data, pwd).map_err(|e| JsValue::from_str(&e))?;

    for (name, entry_data) in entries {
        let buf = Uint8Array::from(&entry_data[..]);
        let _ = callback.call3(
            &JsValue::UNDEFINED,
            &JsValue::from_str(&name),
            &buf.into(),
            &JsValue::from_str("file"),
        );
    }

    Ok(())
}
