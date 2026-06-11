/* @ts-self-types="./wasm_binding.d.ts" */
import * as wasm from "./wasm_binding_bg.wasm";
import { __wbg_set_wasm } from "./wasm_binding_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    WasmKeychain, compress, compress_7z, decompress, decompress_7z, validate_7z, wasm_decrypt_chunk, wasm_decrypt_record, wasm_derive_key, wasm_encrypt_chunk, wasm_encrypt_record, wasm_generate_secret, wasm_get_chunk_nonce
} from "./wasm_binding_bg.js";
