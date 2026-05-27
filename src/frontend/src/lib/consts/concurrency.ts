const hardwareThreads = navigator?.hardwareConcurrency;

// One worker per core — crypto.subtle encrypt/decrypt runs async on the OS thread pool,
// so each worker keeps one full core busy processing its chunk sequentially.
export const WORKER_CONCURRENCY = Math.max(1, hardwareThreads ?? 0);

// Process chunks in larger batches to reduce message-passing overhead for large files.
export const CHUNK_SIZE = 256 * 1024; // 256KB per chunk (was 64KB)
