const hardwareThreads = navigator?.hardwareConcurrency;

// Bound worker count to CPU cores: at least 2x or minimum 4.
export const WORKER_CONCURRENCY = Math.max(1, (hardwareThreads ?? 0) * 2);
export const MIN_WORKERS = 4;
