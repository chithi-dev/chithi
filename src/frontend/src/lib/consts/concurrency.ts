const hardwareThreads = navigator?.hardwareConcurrency;

// Split cores between encryption/decryption workers and zip.js compression.
// Each gets half — enough for full parallelism without thrashing the scheduler.
export const WORKER_CONCURRENCY = Math.max(1, Math.ceil((hardwareThreads ?? 0) / 2));
