mod seven;
mod chithi_cryto;

pub use seven::*;
pub use chithi_cryto::*;

// ---------------------------------------------------------------------------
// Custom entropy source for getrandom on wasm32-unknown-unknown
// ---------------------------------------------------------------------------

use std::sync::atomic::{AtomicU64, Ordering};

static ENTROPY_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Fill a buffer with random bytes using a counter-based PRNG.
/// This is the fallback entropy source for wasm32-unknown-unknown where
/// no system RNG is available. The getrandom crate with feature "custom"
/// calls this function to seed its internal RNG.
#[unsafe(no_mangle)]
pub extern "C" fn __getrandom_custom(buffer: *mut u8, len: usize) -> u8 {
    // Combine monotonic counter with current instruction pointer for entropy
    let counter = ENTROPY_COUNTER.fetch_add(len as u64, Ordering::Relaxed);

    // Simple XOR-shift PRNG seeded with counter
    let mut state = counter.wrapping_add(counter.rotate_right(17)).wrapping_add(0x5A5A5A5A5A5A5A5A);

    unsafe {
        let mut i = 0;
        while i < len {
            // xorshift64 step
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;

            for j in 0..8 {
                if i + j < len {
                    *buffer.add(i + j) = ((state >> (8 * j)) & 0xFF) as u8;
                }
            }
            i += 8;
        }
    }

    0 // 0 = success
}

// ---------------------------------------------------------------------------
// Shared helpers for WASM linear memory access
// ---------------------------------------------------------------------------

/// Read a slice from WASM linear memory at the given pointer.
pub fn read_slice(ptr: u32, len: u32) -> &'static [u8] {
    unsafe { std::slice::from_raw_parts(ptr as *const u8, len as usize) }
}

/// Write bytes to WASM linear memory at the given pointer.
pub fn write_slice(out_ptr: u32, data: &[u8]) {
    unsafe {
        std::ptr::copy_nonoverlapping(
            data.as_ptr(),
            out_ptr as *mut u8,
            data.len(),
        );
    }
}

/// Write a u32 length to WASM linear memory.
pub fn write_out_len(out_len_ptr: u32, len: u32) {
    unsafe { std::ptr::write_volatile(out_len_ptr as *mut u32, len); }
}

// ---------------------------------------------------------------------------
// Serialized chunk array format
// [num_chunks: u32 BE][chunk0_len: u32 BE][chunk0...][chunk1_len: u32 BE][chunk1...]
// ---------------------------------------------------------------------------

pub fn read_chunk_array(data: &[u8]) -> Result<Vec<Vec<u8>>, i32> {
    if data.len() < 4 { return Err(-1); }
    let num = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let mut offset = 4;
    let mut chunks = Vec::with_capacity(num);
    for _ in 0..num {
        if offset + 4 > data.len() { return Err(-2); }
        let len = u32::from_be_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as usize;
        offset += 4;
        if offset + len > data.len() { return Err(-3); }
        chunks.push(data[offset..offset+len].to_vec());
        offset += len;
    }
    Ok(chunks)
}

pub fn write_chunk_array(out: &mut Vec<u8>, chunks: &[Vec<u8>]) {
    out.extend_from_slice(&(chunks.len() as u32).to_be_bytes());
    for chunk in chunks {
        out.extend_from_slice(&(chunk.len() as u32).to_be_bytes());
        out.extend_from_slice(chunk);
    }
}
