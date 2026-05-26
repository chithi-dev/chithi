export const WORKER_CONCURRENCY = Math.max(1, (navigator?.hardwareConcurrency ?? 0) * 2 ?? 4); // bound to cpu
