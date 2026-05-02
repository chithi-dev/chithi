# Chithi WASM Pipeline

This crate provides a high-performance, multi-threaded WASM-based encryption pipeline for Chithi.

## Features

- **Encryption**: ChaCha20-Poly1305 (Exclusive).
- **Parallelism**: Multi-core support via `rayon` and `wasm-bindgen-rayon`.
- **Hardware Acceleration**: Optimized for SIMD128.

## Progress Reporting

The chunk-based encryption and decryption entry points accept an optional progress callback as the last argument.

```typescript
const onProgress = (progress: number) => {
    console.log(`Encryption progress: ${progress.toFixed(1)}%`);
};

const encrypted = wasm.encrypt_chunks_parallel(
    flattenedChunks,
    key,
    baseIv,
    0,
    onProgress,
);
```

When a progress callback is supplied, the operation reports progress from `0` to `100`. The progress-aware path runs sequentially so the callback can fire reliably from WASM.


## Building

To build the WASM module with multi-threading and SIMD support, you need to set specific Rust flags:

```bash
# Install wasm-pack if you haven't
cargo install wasm-pack

# Build with multi-threading and SIMD support
$env:RUSTFLAGS="-C target-feature=+atomics,+bulk-memory,+mutable-globals,+simd128"
wasm-pack build --target web
```

### Important Note on Multi-threading
Using `SharedArrayBuffer` (required for multi-threading) requires your web server to send the following headers:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Usage in Frontend

The `wasm-pipeline.worker.ts` handles initialization and parallel processing.

```typescript
// Initialize with all available cores
worker.postMessage({
    type: 'init',
    keyRaw: key,
    baseIv: iv,
    threads: navigator.hardwareConcurrency
});
```
