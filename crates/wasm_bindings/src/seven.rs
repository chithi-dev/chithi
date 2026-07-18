use std::sync::Arc;

use chithi_core::seven::{sdk_compress_and_encrypt, sdk_decrypt_and_decompress, SevenZBackend, SevenZDefault};
use chithi_core::chithi_cryto::ProgressCallback;

use crate::{read_slice, write_slice, write_out_len};

// ---------------------------------------------------------------------------
// File array serialization format
// [num_files: u32 BE][name0_len: u32 BE][name0 bytes][data0_len: u32 BE][data0 bytes]...
// ---------------------------------------------------------------------------

fn read_file_array(data: &[u8]) -> Result<Vec<(String, Vec<u8>)>, i32> {
    if data.len() < 4 { return Err(-1); }
    let num = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let mut offset = 4;
    let mut files = Vec::with_capacity(num);
    for _ in 0..num {
        if offset + 4 > data.len() { return Err(-2); }
        let name_len = u32::from_be_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;
        if offset + name_len > data.len() { return Err(-3); }
        let name = String::from_utf8(data[offset..offset+name_len].to_vec())
            .map_err(|_| -4i32)?;
        offset += name_len;

        if offset + 4 > data.len() { return Err(-5); }
        let data_len = u32::from_be_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;
        if offset + data_len > data.len() { return Err(-6); }
        let file_data = data[offset..offset+data_len].to_vec();
        offset += data_len;

        files.push((name, file_data));
    }
    Ok(files)
}

fn write_file_array(out: &mut Vec<u8>, files: &[(String, Vec<u8>)]) {
    out.extend_from_slice(&(files.len() as u32).to_be_bytes());
    for (name, data) in files {
        let name_bytes = name.as_bytes();
        out.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(data);
    }
}

// ---------------------------------------------------------------------------
// Event-driven callback bridge (same pattern as chithi_cryto.rs)
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
// 7z operations
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn validate_7z(data_ptr: u32, data_len: u32) -> i32 {
    let data = read_slice(data_ptr, data_len);
    if SevenZDefault::validate(data) { 1 } else { 0 }
}

#[unsafe(no_mangle)]
pub extern "C" fn compress_7z(
    input_ptr: u32,
    input_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let files = match read_file_array(input) { Ok(f) => f, Err(e) => return e };

    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) if !s.is_empty() => Some(s),
        Ok(_) => None,
        Err(_) => return -1,
    };

    let archive = match SevenZDefault::compress(&files, password) {
        Ok(a) => a,
        Err(_) => return -2,
    };

    write_slice(out_ptr, &archive);
    write_out_len(out_len_ptr, archive.len() as u32);
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn decompress_7z(
    data_ptr: u32,
    data_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
) -> i32 {
    let data = read_slice(data_ptr, data_len);

    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) if !s.is_empty() => Some(s),
        Ok(_) => None,
        Err(_) => return -1,
    };

    let entries = match SevenZDefault::decompress(data, password) {
        Ok(e) => e,
        Err(_) => return -2,
    };

    let mut out_buf = Vec::new();
    write_file_array(&mut out_buf, &entries);
    write_slice(out_ptr, &out_buf);
    write_out_len(out_len_ptr, out_buf.len() as u32);
    0
}

// ---------------------------------------------------------------------------
// SDK upload/download (compress + encrypt) — event-driven
// ---------------------------------------------------------------------------

#[unsafe(no_mangle)]
pub extern "C" fn wasm_upload(
    input_ptr: u32,
    input_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let input = read_slice(input_ptr, input_len);
    let files = match read_file_array(input) { Ok(f) => f, Err(e) => return e };

    if files.is_empty() { return -1; }

    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) if !s.is_empty() => Some(s),
        Ok(_) => None,
        Err(_) => return -2,
    };

    let total: usize = files.iter().map(|(_, d)| d.len()).sum();
    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(total));

    let bundle = match sdk_compress_and_encrypt(&files, password, progress) {
        Ok(b) => b,
        Err(_) => return -3,
    };

    write_slice(out_ptr, &bundle);
    write_out_len(out_len_ptr, bundle.len() as u32);
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_download(
    bundle_ptr: u32,
    bundle_len: u32,
    password_ptr: u32,
    password_len: u32,
    out_ptr: u32,
    out_len_ptr: u32,
    callback_fn: usize,
    user_data: usize,
) -> i32 {
    let bundle = read_slice(bundle_ptr, bundle_len);

    let password = match std::str::from_utf8(read_slice(password_ptr, password_len)) {
        Ok(s) if !s.is_empty() => Some(s),
        Ok(_) => None,
        Err(_) => return -1,
    };

    let bridge = CallbackBridge::new(callback_fn, user_data);
    let progress = bridge.as_ref().and_then(|b| b.into_progress(bundle.len()));

    let entries = match sdk_decrypt_and_decompress(bundle, password, progress) {
        Ok(e) => e,
        Err(_) => return -2,
    };

    let mut out_buf = Vec::new();
    write_file_array(&mut out_buf, &entries);
    write_slice(out_ptr, &out_buf);
    write_out_len(out_len_ptr, out_buf.len() as u32);
    0
}
