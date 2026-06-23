---
description: Optimize all Rust code for wasmtime JIT performance when compiling to wasm32-unknown-unknown.
glob: "*.rs"
---

# Rust for Wasmtime Performance

All Rust code compiled to `wasm32-unknown-unknown` must be optimized for wasmtime's JIT execution model. Wasmtime uses Cranelift to compile WASM to native machine code — write Rust that maximizes this pipeline.

## Target

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
# NO wasm-bindgen for exports
# NO PyO3
# Pure C ABI only
```

---

## C ABI Exports — EXACT

All public exports use `#[no_mangle] pub extern "C"` with raw pointers and lengths. No Rust string/Vec crossing the boundary.

```rust
#[no_mangle]
pub extern "C" fn encrypt_chunk(
    data_ptr: *const u8,
    data_len: u32,
    key_ptr: *const u8,
    key_len: u32,
    nonce_ptr: *const u8,
    nonce_len: u32,
    out_ptr: *mut u8,
    out_len: u32,
) -> u32 {
    let data = unsafe { std::slice::from_raw_parts(data_ptr, data_len as usize) };
    let key = unsafe { std::slice::from_raw_parts(key_ptr, key_len as usize) };
    let nonce = unsafe { std::slice::from_raw_parts(nonce_ptr, nonce_len as usize) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, out_len as usize) };

    let written = do_encrypt(data, key, nonce, out);
    written as u32
}
```

**Rules**:
- All buffer I/O: `(*const u8, len: u32)` for input, `(*mut u8, len: u32)` for output
- Return `u32` for byte counts or status codes (0 = success, non-zero = error)
- Never return `String`, `Vec<T>`, or `JsValue` across the boundary
- Caller pre-allocates output buffer, callee writes into it

---

## Linear Memory Management

WASM has a single flat linear memory. Manage it explicitly:

```rust
static ALLOCATOR: std::sync::Mutex<SimpleAllocator> = std::sync::Mutex::new(SimpleAllocator::new());

#[no_mangle]
pub extern "C" fn alloc(len: u32) -> u32 {
    let mut allocator = ALLOCATOR.lock().unwrap();
    allocator.allocate(len as usize) as u32
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: u32, len: u32) {
    let mut allocator = ALLOCATOR.lock().unwrap();
    allocator.deallocate(ptr as usize, len as usize)
}
```

**Rules**:
- Export `alloc` and `dealloc` for host-side memory management
- Use a bump allocator or static pool — no `std::alloc` in WASM target
- Caller is responsible for freeing allocated buffers
- Keep allocations small and short-lived to minimize memory growth

---

## Minimize WASM-Boundary Crossings

Each call across the WASM boundary has overhead (type conversion, trap checking, memory sync). Reduce crossings:

```rust
// GOOD: One call processes entire batch
#[no_mangle]
pub extern "C" fn encrypt_all(
    data_ptr: *const u8,
    data_len: u32,
    key_ptr: *const u8,
    key_len: u32,
    nonce_ptr: *const u8,
    nonce_len: u32,
    out_ptr: *mut u8,
    out_len: u32,
) -> u32 {
    // Internal chunking — host sees one call
}

// BAD: Host calls encrypt_chunk in a loop
#[no_mangle]
pub extern "C" fn encrypt_chunk(/* ... */) -> u32 {
    // Called N times by host for N chunks
}
```

**Rules**:
- Provide bulk operations (`encrypt_all`, `decrypt_all`) alongside per-chunk operations
- Batch internal work — minimize the number of exported function calls
- Keep hot paths inside WASM — don't round-trip to host for intermediate results

---

## Optimize for Cranelift JIT

Wasmtime's Cranelift compiler generates native code from WASM. Write code that Cranelift can optimize well:

### Prefer tight loops

```rust
// GOOD: Cranelift can vectorize
let mut output = [0u8; 1024];
for i in 0..input.len() {
    output[i] = input[i] ^ key[i % key.len()];
}

// BAD: Indirection prevents vectorization
let results: Vec<u8> = input.iter()
    .map(|&b| transform(b, key))
    .collect();
```

### Avoid dynamic dispatch in hot paths

```rust
// GOOD: Monomorphized, inlinable
fn encrypt_aes_gcm(data: &[u8], key: &[u8], nonce: &[u8]) -> [u8; 16] {
    aes_gcm_encrypt(data, key, nonce)
}

// BAD: vtable call — Cranelift cannot inline
trait Cipher {
    fn encrypt(&self, data: &[u8]) -> Vec<u8>;
}
```

### Keep stack usage low

WASM has a limited stack (typically 5MB). Avoid large stack allocations:

```rust
// GOOD: Heap-allocated via WASM linear memory
fn process_large_buffer(data_ptr: *const u8, len: u32) {
    let data = unsafe { std::slice::from_raw_parts(data_ptr, len as usize) };
    // Process in place or use output buffer
}

// BAD: Large stack allocation
fn process_large_buffer(data: &[u8]) {
    let mut buffer = [0u8; 65536]; // 64KB on stack
}
```

---

## Parallelism Inside WASM

Use Rayon for parallel chunk processing within WASM:

```rust
use rayon::prelude::*;

#[no_mangle]
pub extern "C" fn encrypt_chunks_parallel(
    chunks_ptr: *const Chunk,
    chunk_count: u32,
    key_ptr: *const u8,
    key_len: u32,
    results_ptr: *mut ChunkResult,
) -> u32 {
    let chunks = unsafe { std::slice::from_raw_parts(chunks_ptr, chunk_count as usize) };
    let key = unsafe { std::slice::from_raw_parts(key_ptr, key_len as usize) };
    let results = unsafe { std::slice::from_raw_parts_mut(results_ptr, chunk_count as usize) };

    chunks.par_iter().enumerate().for_each(|(i, chunk)| {
        let encrypted = encrypt_single_chunk(chunk.data(), key);
        results[i] = ChunkResult::new(encrypted);
    });

    0 // success
}
```

**Rules**:
- Use `par_iter()` for independent chunk operations
- Parallelism is most effective for large data sets (>1MB)
- Keep per-chunk work significant enough to justify thread overhead

---

## Memory Layout Optimization

WASM linear memory is contiguous. Optimize data layout:

```rust
// GOOD: Compact, cache-friendly
#[repr(C)]
pub struct ChunkInfo {
    offset: u32,
    length: u32,
}

// GOOD: Array of structs for sequential access
let chunks: [ChunkInfo; N] = /* ... */;

// BAD: Padding and indirection
pub struct ChunkInfo {
    name: String,       // heap pointer
    data: Vec<u8>,      // heap pointer
    metadata: Option<Box<Metadata>>, // double heap pointer
}
```

**Rules**:
- Use `#[repr(C)]` on all structs that cross the FFI boundary
- Prefer arrays of structs (AoS) for sequential access
- Avoid heap allocations in tight loops — use output buffers
- Keep struct sizes small and aligned

---

## Release Build Optimizations

```toml
[profile.release]
opt-level = 3           # Aggressive optimization
lto = true              # Link-time optimization
codegen-units = 1       # Single codegen unit for LTO
panic = "abort"         # Smaller binary, no unwind tables
strip = "symbols"       # Remove debug symbols
```

**Rules**:
- Always build with `--release` for production WASM
- LTO is critical for cross-crate inlining
- `panic = "abort"` reduces binary size significantly
- Test with debug builds, ship with release

---

## Measure, Don't Guess

Profile WASM execution with wasmtime:

```bash
# Build
cargo build --target wasm32-unknown-unknown --release

# Profile with wasmtime
wasmtime profile target/wasm32-unknown-unknown/release/chithi_wasm.wasm

# Check binary size
wasm-opt --metrics chithi_wasm.wasm
```

**Rules**:
- Measure actual execution time, not Rust benchmark time
- Monitor WASM binary size — smaller = faster JIT compile
- Profile the critical path: key derivation → encryption → upload
- Track linear memory growth — unexpected growth indicates leaks

---

## What NOT to Do

1. **Do NOT** use `wasm-bindgen` for exported functions — pure C ABI only
2. **Do NOT** return `String` or `Vec<T>` from exported functions
3. **Do NOT** use `println!` or `eprintln!` — no stdout in WASM
4. **Do NOT** allocate large buffers on the stack
5. **Do NOT** use `std::thread` — use Rayon for parallelism
6. **Do NOT** use `std::fs` or `std::net` — not available in `wasm32-unknown-unknown`
7. **Do NOT** use `lazy_static` or `once_cell` with non-`const` initializers — WASM has no dynamic init
8. **Do NOT** rely on system entropy (`/dev/urandom`) — use `getrandom` crate with `js` or WASI backend

---

## Enforcement

When writing Rust for the WASM target:
1. Use `#[no_mangle] pub extern "C"` for all exports
2. All buffer I/O via `(*const u8, len: u32)` pattern
3. Prefer bulk operations over per-item calls
4. Optimize for Cranelift: tight loops, no dynamic dispatch, low stack
5. Profile with wasmtime, not `criterion`
