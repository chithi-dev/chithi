/* tslint:disable */
/* eslint-disable */

/**
 * Compresses multiple entries into a 7z archive in WebAssembly environment.
 *
 * This function creates a compressed archive from multiple file entries,
 * designed specifically for WASM targets.
 *
 * # Arguments
 * * `entries` - Vector of JavaScript strings representing file names/paths
 * * `datas` - Vector of Uint8Arrays containing the file data corresponding to entries
 */
export function compress(entries: string[], datas: Uint8Array[]): Uint8Array;

export function create_7z(entries: any): Uint8Array;

/**
 * Decompresses a 7z archive in WebAssembly environment.
 *
 * This function is specifically designed for WASM targets and uses JavaScript interop
 * to handle the decompression process with a callback function.
 *
 * # Arguments
 * * `src` - Uint8Array containing the compressed archive data
 * * `pwd` - Password string for encrypted archives (use empty string for unencrypted)
 * * `f` - JavaScript callback function to handle extracted entries
 */
export function decompress(src: Uint8Array, pwd: string, f: Function): void;

export function decrypt_chunk(
	data: Uint8Array,
	key: Uint8Array,
	base_iv: Uint8Array,
	index: number,
	_decompress: boolean
): Uint8Array;

export function decrypt_chunks_parallel(
	flattened_chunks: Uint8Array,
	key: Uint8Array,
	base_iv: Uint8Array,
	start_index: number,
	decompress: boolean,
	progress_callback?: Function | null
): Uint8Array;

export function encrypt_chunk(
	data: Uint8Array,
	key: Uint8Array,
	base_iv: Uint8Array,
	index: number,
	_compress: boolean
): Uint8Array;

export function encrypt_chunks_parallel(
	flattened_chunks: Uint8Array,
	key: Uint8Array,
	base_iv: Uint8Array,
	start_index: number,
	compress: boolean,
	progress_callback?: Function | null
): Uint8Array;

export function initThreadPool(num_threads: number): Promise<any>;

export class wbg_rayon_PoolBuilder {
	private constructor();
	free(): void;
	[Symbol.dispose](): void;
	build(): void;
	numThreads(): number;
	receiver(): number;
}

export function wbg_rayon_start_worker(receiver: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
	readonly memory: WebAssembly.Memory;
	readonly create_7z: (a: any) => [number, number, number, number];
	readonly decrypt_chunk: (
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
		h: number
	) => [number, number, number, number];
	readonly decrypt_chunks_parallel: (
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
		h: number,
		i: number
	) => [number, number, number, number];
	readonly encrypt_chunk: (
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
		h: number
	) => [number, number, number, number];
	readonly encrypt_chunks_parallel: (
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
		h: number,
		i: number
	) => [number, number, number, number];
	readonly __wbg_wbg_rayon_poolbuilder_free: (a: number, b: number) => void;
	readonly initThreadPool: (a: number) => any;
	readonly wbg_rayon_poolbuilder_build: (a: number) => void;
	readonly wbg_rayon_poolbuilder_numThreads: (a: number) => number;
	readonly wbg_rayon_poolbuilder_receiver: (a: number) => number;
	readonly wbg_rayon_start_worker: (a: number) => void;
	readonly compress: (a: number, b: number, c: number, d: number) => [number, number, number];
	readonly decompress: (a: any, b: number, c: number, d: any) => [number, number];
	readonly __wbindgen_malloc: (a: number, b: number) => number;
	readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
	readonly __wbindgen_exn_store: (a: number) => void;
	readonly __externref_table_alloc: () => number;
	readonly __wbindgen_externrefs: WebAssembly.Table;
	readonly __externref_table_dealloc: (a: number) => void;
	readonly __wbindgen_free: (a: number, b: number, c: number) => void;
	readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
	module_or_path?:
		| { module_or_path: InitInput | Promise<InitInput> }
		| InitInput
		| Promise<InitInput>
): Promise<InitOutput>;
