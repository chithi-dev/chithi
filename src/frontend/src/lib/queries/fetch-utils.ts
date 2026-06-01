export const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;
