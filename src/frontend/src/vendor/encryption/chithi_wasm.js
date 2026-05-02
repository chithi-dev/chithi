/* @ts-self-types="./chithi_wasm.d.ts" */
import { startWorkers } from './snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.js';

/**
 * @param {any} entries
 * @param {string | null} [pwd]
 * @returns {Uint8Array}
 */
export function compress(entries, pwd) {
	var ptr0 = isLikeNone(pwd)
		? 0
		: passStringToWasm0(pwd, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
	var len0 = WASM_VECTOR_LEN;
	const ret = wasm.compress(entries, ptr0, len0);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v2;
}

/**
 * @param {any} entries
 * @param {string | null} [pwd]
 * @returns {Uint8Array}
 */
export function create_7z(entries, pwd) {
	var ptr0 = isLikeNone(pwd)
		? 0
		: passStringToWasm0(pwd, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
	var len0 = WASM_VECTOR_LEN;
	const ret = wasm.create_7z(entries, ptr0, len0);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v2;
}

/**
 * @param {Uint8Array} src
 * @param {string} pwd
 * @param {Function} f
 */
export function decompress(src, pwd, f) {
	const ptr0 = passArray8ToWasm0(src, wasm.__wbindgen_malloc);
	const len0 = WASM_VECTOR_LEN;
	const ptr1 = passStringToWasm0(pwd, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
	const len1 = WASM_VECTOR_LEN;
	const ret = wasm.decompress(ptr0, len0, ptr1, len1, f);
	if (ret[1]) {
		throw takeFromExternrefTable0(ret[0]);
	}
}

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @param {number} index
 * @param {boolean} _decompress
 * @returns {Uint8Array}
 */
export function decrypt_chunk(data, key, base_iv, index, _decompress) {
	const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
	const len0 = WASM_VECTOR_LEN;
	const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
	const len1 = WASM_VECTOR_LEN;
	const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
	const len2 = WASM_VECTOR_LEN;
	const ret = wasm.decrypt_chunk(ptr0, len0, ptr1, len1, ptr2, len2, index, _decompress);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v4;
}

/**
 * @param {Uint8Array} flattened_chunks
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @param {number} start_index
 * @param {boolean} decompress
 * @param {Function | null} [progress_callback]
 * @returns {Uint8Array}
 */
export function decrypt_chunks_parallel(
	flattened_chunks,
	key,
	base_iv,
	start_index,
	decompress,
	progress_callback
) {
	const ptr0 = passArray8ToWasm0(flattened_chunks, wasm.__wbindgen_malloc);
	const len0 = WASM_VECTOR_LEN;
	const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
	const len1 = WASM_VECTOR_LEN;
	const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
	const len2 = WASM_VECTOR_LEN;
	const ret = wasm.decrypt_chunks_parallel(
		ptr0,
		len0,
		ptr1,
		len1,
		ptr2,
		len2,
		start_index,
		decompress,
		isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback)
	);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v4;
}

/**
 * @param {Uint8Array} data
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @param {number} index
 * @param {boolean} _compress
 * @returns {Uint8Array}
 */
export function encrypt_chunk(data, key, base_iv, index, _compress) {
	const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
	const len0 = WASM_VECTOR_LEN;
	const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
	const len1 = WASM_VECTOR_LEN;
	const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
	const len2 = WASM_VECTOR_LEN;
	const ret = wasm.encrypt_chunk(ptr0, len0, ptr1, len1, ptr2, len2, index, _compress);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v4;
}

/**
 * @param {Uint8Array} flattened_chunks
 * @param {Uint8Array} key
 * @param {Uint8Array} base_iv
 * @param {number} start_index
 * @param {boolean} compress
 * @param {Function | null} [progress_callback]
 * @returns {Uint8Array}
 */
export function encrypt_chunks_parallel(
	flattened_chunks,
	key,
	base_iv,
	start_index,
	compress,
	progress_callback
) {
	const ptr0 = passArray8ToWasm0(flattened_chunks, wasm.__wbindgen_malloc);
	const len0 = WASM_VECTOR_LEN;
	const ptr1 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
	const len1 = WASM_VECTOR_LEN;
	const ptr2 = passArray8ToWasm0(base_iv, wasm.__wbindgen_malloc);
	const len2 = WASM_VECTOR_LEN;
	const ret = wasm.encrypt_chunks_parallel(
		ptr0,
		len0,
		ptr1,
		len1,
		ptr2,
		len2,
		start_index,
		compress,
		isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback)
	);
	if (ret[3]) {
		throw takeFromExternrefTable0(ret[2]);
	}
	var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
	wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
	return v4;
}

/**
 * @param {number} num_threads
 * @returns {Promise<any>}
 */
export function initThreadPool(num_threads) {
	const ret = wasm.initThreadPool(num_threads);
	return ret;
}

export class wbg_rayon_PoolBuilder {
	static __wrap(ptr) {
		const obj = Object.create(wbg_rayon_PoolBuilder.prototype);
		obj.__wbg_ptr = ptr;
		wbg_rayon_PoolBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
		return obj;
	}
	__destroy_into_raw() {
		const ptr = this.__wbg_ptr;
		this.__wbg_ptr = 0;
		wbg_rayon_PoolBuilderFinalization.unregister(this);
		return ptr;
	}
	free() {
		const ptr = this.__destroy_into_raw();
		wasm.__wbg_wbg_rayon_poolbuilder_free(ptr, 0);
	}
	build() {
		wasm.wbg_rayon_poolbuilder_build(this.__wbg_ptr);
	}
	/**
	 * @returns {number}
	 */
	numThreads() {
		const ret = wasm.wbg_rayon_poolbuilder_numThreads(this.__wbg_ptr);
		return ret >>> 0;
	}
	/**
	 * @returns {number}
	 */
	receiver() {
		const ret = wasm.wbg_rayon_poolbuilder_receiver(this.__wbg_ptr);
		return ret >>> 0;
	}
}
if (Symbol.dispose)
	wbg_rayon_PoolBuilder.prototype[Symbol.dispose] = wbg_rayon_PoolBuilder.prototype.free;

/**
 * @param {number} receiver
 */
export function wbg_rayon_start_worker(receiver) {
	wasm.wbg_rayon_start_worker(receiver);
}
function __wbg_get_imports() {
	const import0 = {
		__proto__: null,
		__wbg___wbindgen_is_undefined_244a92c34d3b6ec0: function (arg0) {
			const ret = arg0 === undefined;
			return ret;
		},
		__wbg___wbindgen_memory_c2356dd1a089dfbd: function () {
			const ret = wasm.memory;
			return ret;
		},
		__wbg___wbindgen_module_df704393dfd1853c: function () {
			const ret = wasmModule;
			return ret;
		},
		__wbg___wbindgen_string_get_965592073e5d848c: function (arg0, arg1) {
			const obj = arg1;
			const ret = typeof obj === 'string' ? obj : undefined;
			var ptr1 = isLikeNone(ret)
				? 0
				: passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
			var len1 = WASM_VECTOR_LEN;
			getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
			getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
		},
		__wbg___wbindgen_throw_9c75d47bf9e7731e: function (arg0, arg1) {
			throw new Error(getStringFromWasm0(arg0, arg1));
		},
		__wbg_call_a41d6421b30a32c5: function () {
			return handleError(function (arg0, arg1, arg2) {
				const ret = arg0.call(arg1, arg2);
				return ret;
			}, arguments);
		},
		__wbg_from_ff141b1e4c69b979: function (arg0) {
			const ret = Array.from(arg0);
			return ret;
		},
		__wbg_getRandomValues_783a29df2108885b: function () {
			return handleError(function (arg0) {
				globalThis.crypto.getRandomValues(arg0);
			}, arguments);
		},
		__wbg_get_41476db20fef99a8: function () {
			return handleError(function (arg0, arg1) {
				const ret = Reflect.get(arg0, arg1);
				return ret;
			}, arguments);
		},
		__wbg_get_unchecked_be562b1421656321: function (arg0, arg1) {
			const ret = arg0[arg1 >>> 0];
			return ret;
		},
		__wbg_instanceof_Window_4153c1818a1c0c0b: function (arg0) {
			let result;
			try {
				result = arg0 instanceof Window;
			} catch (_) {
				result = false;
			}
			const ret = result;
			return ret;
		},
		__wbg_length_0a6ce016dc1460b0: function (arg0) {
			const ret = arg0.length;
			return ret;
		},
		__wbg_length_ba3c032602efe310: function (arg0) {
			const ret = arg0.length;
			return ret;
		},
		__wbg_new_2fad8ca02fd00684: function () {
			const ret = new Object();
			return ret;
		},
		__wbg_new_8454eee672b2ba6e: function (arg0) {
			const ret = new Uint8Array(arg0);
			return ret;
		},
		__wbg_new_from_slice_5a173c243af2e823: function (arg0, arg1) {
			const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
			return ret;
		},
		__wbg_new_with_length_9011f5da794bf5d9: function (arg0) {
			const ret = new Uint8Array(arg0 >>> 0);
			return ret;
		},
		__wbg_prototypesetcall_fd4050e806e1d519: function (arg0, arg1, arg2) {
			Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
		},
		__wbg_set_5337f8ac82364a3f: function () {
			return handleError(function (arg0, arg1, arg2) {
				const ret = Reflect.set(arg0, arg1, arg2);
				return ret;
			}, arguments);
		},
		__wbg_startWorkers_8b582d57e92bd2d4: function (arg0, arg1, arg2) {
			const ret = startWorkers(arg0, arg1, wbg_rayon_PoolBuilder.__wrap(arg2));
			return ret;
		},
		__wbg_static_accessor_GLOBAL_THIS_1c7f1bd6c6941fdb: function () {
			const ret = typeof globalThis === 'undefined' ? null : globalThis;
			return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
		},
		__wbg_static_accessor_GLOBAL_e039bc914f83e74e: function () {
			const ret = typeof global === 'undefined' ? null : global;
			return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
		},
		__wbg_static_accessor_SELF_8bf8c48c28420ad5: function () {
			const ret = typeof self === 'undefined' ? null : self;
			return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
		},
		__wbg_static_accessor_WINDOW_6aeee9b51652ee0f: function () {
			const ret = typeof window === 'undefined' ? null : window;
			return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
		},
		__wbg_subarray_fbe3cef290e1fa43: function (arg0, arg1, arg2) {
			const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
			return ret;
		},
		__wbindgen_cast_0000000000000001: function (arg0) {
			// Cast intrinsic for `F64 -> Externref`.
			const ret = arg0;
			return ret;
		},
		__wbindgen_cast_0000000000000002: function (arg0, arg1) {
			// Cast intrinsic for `Ref(String) -> Externref`.
			const ret = getStringFromWasm0(arg0, arg1);
			return ret;
		},
		__wbindgen_init_externref_table: function () {
			const table = wasm.__wbindgen_externrefs;
			const offset = table.grow(4);
			table.set(0, undefined);
			table.set(offset + 0, undefined);
			table.set(offset + 1, null);
			table.set(offset + 2, true);
			table.set(offset + 3, false);
		}
	};
	return {
		__proto__: null,
		'./chithi_wasm_bg.js': import0
	};
}

const wbg_rayon_PoolBuilderFinalization =
	typeof FinalizationRegistry === 'undefined'
		? { register: () => {}, unregister: () => {} }
		: new FinalizationRegistry((ptr) => wasm.__wbg_wbg_rayon_poolbuilder_free(ptr, 1));

function addToExternrefTable0(obj) {
	const idx = wasm.__externref_table_alloc();
	wasm.__wbindgen_externrefs.set(idx, obj);
	return idx;
}

function getArrayU8FromWasm0(ptr, len) {
	ptr = ptr >>> 0;
	return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
	if (
		cachedDataViewMemory0 === null ||
		cachedDataViewMemory0.buffer.detached === true ||
		(cachedDataViewMemory0.buffer.detached === undefined &&
			cachedDataViewMemory0.buffer !== wasm.memory.buffer)
	) {
		cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
	}
	return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
	return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
	if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
		cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
	}
	return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
	try {
		return f.apply(this, args);
	} catch (e) {
		const idx = addToExternrefTable0(e);
		wasm.__wbindgen_exn_store(idx);
	}
}

function isLikeNone(x) {
	return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
	const ptr = malloc(arg.length * 1, 1) >>> 0;
	getUint8ArrayMemory0().set(arg, ptr / 1);
	WASM_VECTOR_LEN = arg.length;
	return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
	if (realloc === undefined) {
		const buf = cachedTextEncoder.encode(arg);
		const ptr = malloc(buf.length, 1) >>> 0;
		getUint8ArrayMemory0()
			.subarray(ptr, ptr + buf.length)
			.set(buf);
		WASM_VECTOR_LEN = buf.length;
		return ptr;
	}

	let len = arg.length;
	let ptr = malloc(len, 1) >>> 0;

	const mem = getUint8ArrayMemory0();

	let offset = 0;

	for (; offset < len; offset++) {
		const code = arg.charCodeAt(offset);
		if (code > 0x7f) break;
		mem[ptr + offset] = code;
	}
	if (offset !== len) {
		if (offset !== 0) {
			arg = arg.slice(offset);
		}
		ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
		const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
		const ret = cachedTextEncoder.encodeInto(arg, view);

		offset += ret.written;
		ptr = realloc(ptr, len, offset, 1) >>> 0;
	}

	WASM_VECTOR_LEN = offset;
	return ptr;
}

function takeFromExternrefTable0(idx) {
	const value = wasm.__wbindgen_externrefs.get(idx);
	wasm.__externref_table_dealloc(idx);
	return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
	numBytesDecoded += len;
	if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
		cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
		cachedTextDecoder.decode();
		numBytesDecoded = len;
	}
	return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
	cachedTextEncoder.encodeInto = function (arg, view) {
		const buf = cachedTextEncoder.encode(arg);
		view.set(buf);
		return {
			read: arg.length,
			written: buf.length
		};
	};
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
	wasmInstance = instance;
	wasm = instance.exports;
	wasmModule = module;
	cachedDataViewMemory0 = null;
	cachedUint8ArrayMemory0 = null;
	wasm.__wbindgen_start();
	return wasm;
}

async function __wbg_load(module, imports) {
	if (typeof Response === 'function' && module instanceof Response) {
		if (typeof WebAssembly.instantiateStreaming === 'function') {
			try {
				return await WebAssembly.instantiateStreaming(module, imports);
			} catch (e) {
				const validResponse = module.ok && expectedResponseType(module.type);

				if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
					console.warn(
						'`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
						e
					);
				} else {
					throw e;
				}
			}
		}

		const bytes = await module.arrayBuffer();
		return await WebAssembly.instantiate(bytes, imports);
	} else {
		const instance = await WebAssembly.instantiate(module, imports);

		if (instance instanceof WebAssembly.Instance) {
			return { instance, module };
		} else {
			return instance;
		}
	}

	function expectedResponseType(type) {
		switch (type) {
			case 'basic':
			case 'cors':
			case 'default':
				return true;
		}
		return false;
	}
}

function initSync(module) {
	if (wasm !== undefined) return wasm;

	if (module !== undefined) {
		if (Object.getPrototypeOf(module) === Object.prototype) {
			({ module } = module);
		} else {
			console.warn('using deprecated parameters for `initSync()`; pass a single object instead');
		}
	}

	const imports = __wbg_get_imports();
	if (!(module instanceof WebAssembly.Module)) {
		module = new WebAssembly.Module(module);
	}
	const instance = new WebAssembly.Instance(module, imports);
	return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
	if (wasm !== undefined) return wasm;

	if (module_or_path !== undefined) {
		if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
			({ module_or_path } = module_or_path);
		} else {
			console.warn(
				'using deprecated parameters for the initialization function; pass a single object instead'
			);
		}
	}

	if (module_or_path === undefined) {
		module_or_path = new URL('chithi_wasm_bg.wasm', import.meta.url);
	}
	const imports = __wbg_get_imports();

	if (
		typeof module_or_path === 'string' ||
		(typeof Request === 'function' && module_or_path instanceof Request) ||
		(typeof URL === 'function' && module_or_path instanceof URL)
	) {
		module_or_path = fetch(module_or_path);
	}

	const { instance, module } = await __wbg_load(await module_or_path, imports);

	return __wbg_finalize_init(instance, module);
}

export { __wbg_init as default, initSync };
