export const WORKER_CONCURRENCY = Math.max(1, navigator.hardwareConcurrency ?? 0);
export const CHUNK_SIZE = 256 * 1024;
