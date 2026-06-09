use std::io::Cursor;

use sevenz_rust2::{ArchiveEntry, ArchiveReader, ArchiveWriter, Password};
use wasm_bindgen::prelude::*;

/// Validate that the given bytes are a 7z archive.
/// Returns true if valid, false if not.
#[wasm_bindgen]
pub fn validate_7z(data: &[u8]) -> bool {
    use chithi_core::seven::SEVENZ_MAGIC;
    data.len() >= SEVENZ_MAGIC.len() && data[..SEVENZ_MAGIC.len()] == SEVENZ_MAGIC
}

/// Compress files into a 7z archive with optional AES-256 encryption.
/// If password is non-empty, all entries are encrypted with 7z native AES-256.
#[wasm_bindgen]
pub fn compress_7z(
    names: Vec<JsValue>,
    datas: Vec<Uint8Array>,
    password: String,
) -> Result<Uint8Array, JsValue> {
    use chithi_core::seven;

    let pwd = if password.is_empty() { None } else { Some(&password) };

    let files: Vec<(String, Vec<u8>)> = names
        .into_iter()
        .zip(datas.into_iter())
        .map(|(name, data)| (name.as_string().unwrap_or_default(), data.to_vec()))
        .collect();

    let archive = seven::compress(&files, pwd).map_err(|e| JsValue::from_str(&e))?;
    Ok(archive.into())
}

/// Decompress a 7z archive with optional password for encrypted archives.
/// Calls the callback for each entry with (name, data).
#[wasm_bindgen]
pub fn decompress_7z(
    data: &[u8],
    password: String,
    callback: &js_sys::Function,
) -> Result<(), JsValue> {
    use chithi_core::seven;

    let pwd = if password.is_empty() { None } else { Some(&password) };

    let entries = seven::decompress(data, pwd).map_err(|e| JsValue::from_str(&e))?;

    for (name, entry_data) in entries {
        let buf = Uint8Array::from(entry_data);
        let _ = callback.call3(
            &JsValue::UNDEFINED,
            &JsValue::from_str(&name),
            &buf.into(),
            &JsValue::from_str("file"),
        );
    }

    Ok(())
}
