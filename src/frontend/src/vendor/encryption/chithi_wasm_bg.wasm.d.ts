/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const compress: (a: any, b: number, c: number) => [number, number, number, number];
export const create_7z: (a: any, b: number, c: number) => [number, number, number, number];
export const decompress: (a: number, b: number, c: number, d: number, e: any) => [number, number];
export const decrypt_chunk: (
	a: number,
	b: number,
	c: number,
	d: number,
	e: number,
	f: number,
	g: number
) => [number, number, number, number];
export const decrypt_chunks_parallel: (
	a: number,
	b: number,
	c: number,
	d: number,
	e: number,
	f: number,
	g: number,
	h: number
) => [number, number, number, number];
export const encrypt_chunk: (
	a: number,
	b: number,
	c: number,
	d: number,
	e: number,
	f: number,
	g: number
) => [number, number, number, number];
export const encrypt_chunks_parallel: (
	a: number,
	b: number,
	c: number,
	d: number,
	e: number,
	f: number,
	g: number,
	h: number
) => [number, number, number, number];
export const __wbg_wbg_rayon_poolbuilder_free: (a: number, b: number) => void;
export const initThreadPool: (a: number) => any;
export const wbg_rayon_poolbuilder_build: (a: number) => void;
export const wbg_rayon_poolbuilder_numThreads: (a: number) => number;
export const wbg_rayon_poolbuilder_receiver: (a: number) => number;
export const wbg_rayon_start_worker: (a: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
