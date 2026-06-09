/* @ts-self-types="./chithi_core.d.ts" */
import * as wasm from "./chithi_core_bg.wasm";
import { __wbg_set_wasm } from "./chithi_core_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    argon2_derive, compress, compress_7z, decompress, decompress_7z, generate_ikm, validate_7z
} from "./chithi_core_bg.js";
