use chacha20poly1305::{
    ChaCha20Poly1305, Nonce,
    aead::{Aead, KeyInit},
};
use js_sys::Function;
use js_sys::{Array, Uint8Array};
use rayon::prelude::*;
use sevenz_rust2::{ArchiveEntry, ArchiveWriter};
use std::io::Cursor;
use thiserror::Error;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

// Expose rayon thread pool initialization for WASM
pub use wasm_bindgen_rayon::init_thread_pool;

#[derive(Error, Debug)]
pub enum PipelineError {
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("Decryption error: {0}")]
    Decryption(String),
    #[error("Invalid key length: expected 32, got {actual}")]
    InvalidKeyLength { actual: usize },
    #[error("Invalid IV length: expected 12, got {actual}")]
    InvalidIvLength { actual: usize },
}

impl From<PipelineError> for JsValue {
    fn from(err: PipelineError) -> JsValue {
        JsValue::from_str(&err.to_string())
    }
}

fn get_chunk_iv(base_iv: &[u8], chunk_index: u32) -> [u8; 12] {
    let mut iv = [0u8; 12];
    iv.copy_from_slice(&base_iv[..12]);

    // XOR the chunk index into the last 4 bytes (big-endian)
    let last4 = u32::from_be_bytes([iv[8], iv[9], iv[10], iv[11]]);
    let xored = last4 ^ chunk_index;
    let xored_bytes = xored.to_be_bytes();
    iv[8..12].copy_from_slice(&xored_bytes);
    iv
}

#[wasm_bindgen]
pub fn encrypt_chunk(
    data: &[u8],
    key: &[u8],
    base_iv: &[u8],
    index: u32,
    _compress: bool,
) -> Result<Vec<u8>, JsValue> {
    if key.len() != 32 {
        return Err(PipelineError::InvalidKeyLength { actual: key.len() }.into());
    }
    if base_iv.len() < 12 {
        return Err(PipelineError::InvalidIvLength {
            actual: base_iv.len(),
        }
        .into());
    }

    // Compression is intentionally handled externally (e.g. sevenz).
    // This function now encrypts raw chunk bytes only.
    let iv = get_chunk_iv(base_iv, index);
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(&iv);

    let encrypted = cipher
        .encrypt(nonce, data)
        .map_err(|e| PipelineError::Encryption(e.to_string()))?;

    Ok(encrypted)
}

#[wasm_bindgen]
pub fn decrypt_chunk(
    data: &[u8],
    key: &[u8],
    base_iv: &[u8],
    index: u32,
    _decompress: bool,
) -> Result<Vec<u8>, JsValue> {
    if key.len() != 32 {
        return Err(PipelineError::InvalidKeyLength { actual: key.len() }.into());
    }
    if base_iv.len() < 12 {
        return Err(PipelineError::InvalidIvLength {
            actual: base_iv.len(),
        }
        .into());
    }

    // Decompression is intentionally handled externally (e.g. sevenz).
    // This function now decrypts and returns raw chunk bytes only.
    let iv = get_chunk_iv(base_iv, index);
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(&iv);

    let decrypted: Vec<u8> = cipher
        .decrypt(nonce, data)
        .map_err(|e| PipelineError::Decryption(e.to_string()))?;

    Ok(decrypted)
}

// Helper functions to convert between flattened and nested vectors
// Format: [size1(4 bytes), chunk1_data, size2(4 bytes), chunk2_data, ...]
fn unflatten_chunks(data: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    let mut chunks = Vec::new();
    let mut pos = 0;

    while pos < data.len() {
        if pos + 4 > data.len() {
            return Err("Invalid chunk metadata".to_string());
        }

        let size_bytes = [data[pos], data[pos + 1], data[pos + 2], data[pos + 3]];
        let size = u32::from_le_bytes(size_bytes) as usize;
        pos += 4;

        if pos + size > data.len() {
            return Err("Chunk data exceeds buffer".to_string());
        }

        chunks.push(data[pos..pos + size].to_vec());
        pos += size;
    }

    Ok(chunks)
}

fn flatten_chunks(chunks: &[Vec<u8>]) -> Vec<u8> {
    let mut result = Vec::new();
    for chunk in chunks {
        let size = chunk.len() as u32;
        result.extend_from_slice(&size.to_le_bytes());
        result.extend_from_slice(chunk);
    }
    result
}

fn report_progress(
    progress_callback: Option<&Function>,
    completed: usize,
    total: usize,
) -> Result<(), JsValue> {
    if let Some(callback) = progress_callback {
        let progress = if total == 0 {
            100.0
        } else {
            (completed as f64 / total as f64) * 100.0
        };

        callback
            .call1(&JsValue::NULL, &JsValue::from_f64(progress))
            .map(|_| ())?;
    }

    Ok(())
}

fn encrypt_chunks_with_progress_internal(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    compress: bool,
    progress_callback: Option<&Function>,
) -> Result<Vec<Vec<u8>>, JsValue> {
    let total = chunks.len();
    let mut encrypted_chunks = Vec::with_capacity(total);

    report_progress(progress_callback, 0, total)?;

    for (i, chunk) in chunks.into_iter().enumerate() {
        let encrypted = encrypt_chunk(&chunk, key, base_iv, start_index + i as u32, compress)?;
        encrypted_chunks.push(encrypted);
        report_progress(progress_callback, i + 1, total)?;
    }

    Ok(encrypted_chunks)
}

fn decrypt_chunks_with_progress_internal(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    decompress: bool,
    progress_callback: Option<&Function>,
) -> Result<Vec<Vec<u8>>, JsValue> {
    let total = chunks.len();
    let mut decrypted_chunks = Vec::with_capacity(total);

    report_progress(progress_callback, 0, total)?;

    for (i, chunk) in chunks.into_iter().enumerate() {
        let decrypted = decrypt_chunk(&chunk, key, base_iv, start_index + i as u32, decompress)?;
        decrypted_chunks.push(decrypted);
        report_progress(progress_callback, i + 1, total)?;
    }

    Ok(decrypted_chunks)
}

// Internal parallel processing functions that use rayon with String errors
fn encrypt_chunks_parallel_internal(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    compress: bool,
) -> Result<Vec<Vec<u8>>, String> {
    chunks
        .into_par_iter()
        .enumerate()
        .map(|(i, chunk)| {
            encrypt_chunk(&chunk, key, base_iv, start_index + i as u32, compress)
                .map_err(|e| e.as_string().unwrap_or_else(|| "Unknown error".to_string()))
        })
        .collect()
}

fn decrypt_chunks_parallel_internal(
    chunks: Vec<Vec<u8>>,
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    decompress: bool,
) -> Result<Vec<Vec<u8>>, String> {
    chunks
        .into_par_iter()
        .enumerate()
        .map(|(i, chunk)| {
            decrypt_chunk(&chunk, key, base_iv, start_index + i as u32, decompress)
                .map_err(|e| e.as_string().unwrap_or_else(|| "Unknown error".to_string()))
        })
        .collect()
}

// WASM-bindgen compatible functions with flattened input/output
#[wasm_bindgen]
pub fn encrypt_chunks_parallel(
    flattened_chunks: &[u8],
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    compress: bool,
    progress_callback: Option<Function>,
) -> Result<Vec<u8>, JsValue> {
    let chunks = unflatten_chunks(flattened_chunks).map_err(|e| JsValue::from_str(&e))?;

    let encrypted_chunks = if let Some(callback) = progress_callback.as_ref() {
        encrypt_chunks_with_progress_internal(
            chunks,
            key,
            base_iv,
            start_index,
            compress,
            Some(callback),
        )?
    } else {
        encrypt_chunks_parallel_internal(chunks, key, base_iv, start_index, compress)
            .map_err(|e| JsValue::from_str(&e))?
    };

    Ok(flatten_chunks(&encrypted_chunks))
}

#[wasm_bindgen]
pub fn decrypt_chunks_parallel(
    flattened_chunks: &[u8],
    key: &[u8],
    base_iv: &[u8],
    start_index: u32,
    decompress: bool,
    progress_callback: Option<Function>,
) -> Result<Vec<u8>, JsValue> {
    let chunks = unflatten_chunks(flattened_chunks).map_err(|e| JsValue::from_str(&e))?;

    let decrypted_chunks = if let Some(callback) = progress_callback.as_ref() {
        decrypt_chunks_with_progress_internal(
            chunks,
            key,
            base_iv,
            start_index,
            decompress,
            Some(callback),
        )?
    } else {
        decrypt_chunks_parallel_internal(chunks, key, base_iv, start_index, decompress)
            .map_err(|e| JsValue::from_str(&e))?
    };

    Ok(flatten_chunks(&decrypted_chunks))
}

// Create a .7z archive in memory from JS-provided entries.
// `entries` should be an array of objects: { name: string, data: Uint8Array }
#[wasm_bindgen]
pub fn create_7z(entries: &JsValue) -> Result<Vec<u8>, JsValue> {
    let arr = Array::from(entries);

    let cursor = Cursor::new(Vec::new());
    let mut writer = ArchiveWriter::new(cursor)
        .map_err(|e| JsValue::from_str(&format!("sevenz init error: {}", e)))?;

    for v in arr.iter() {
        let name_js =
            js_sys::Reflect::get(&v, &JsValue::from_str("name")).map_err(|e| JsValue::from(e))?;
        let name = name_js
            .as_string()
            .ok_or_else(|| JsValue::from_str("entry.name must be string"))?;

        let data_js =
            js_sys::Reflect::get(&v, &JsValue::from_str("data")).map_err(|e| JsValue::from(e))?;
        let u8arr = Uint8Array::new(&data_js);
        let mut buf = vec![0u8; u8arr.length() as usize];
        u8arr.copy_to(&mut buf[..]);

        let entry = ArchiveEntry::new_file(&name);
        let reader = std::io::Cursor::new(buf);
        writer
            .push_archive_entry(entry, Some(reader))
            .map_err(|e| JsValue::from_str(&format!("sevenz append error: {}", e)))?;
    }

    let finished = writer
        .finish()
        .map_err(|e| JsValue::from_str(&format!("sevenz finish error: {}", e)))?;

    // finished is Cursor<Vec<u8>>; extract inner Vec<u8>
    Ok(finished.into_inner())
}
