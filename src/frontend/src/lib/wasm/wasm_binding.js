/* @ts-self-types="./wasm_binding.d.ts" */
import * as wasm from "./wasm_binding_bg.wasm";
import { __wbg_set_wasm } from "./wasm_binding_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    argon2_derive, compress, decompress, generate_ikm, validate_7z
} from "./wasm_binding_bg.js";
