/**
 * Type declaration for the web-target WASM bindings.
 * Same build works in both Node.js and browser.
 */

declare module './wasm/wasm_bindings.js' {
  export function upload(names: any[], datas: Uint8Array[], password: string): Uint8Array;
  export function download(bundle: Uint8Array, password: string): Array<{ name: string; data: Uint8Array }>;
  export function uploadData(data: Uint8Array, password: string): string;
  export function downloadData(bundleJson: string, password: string): Uint8Array;
  export function compress_7z(names: any[], datas: Uint8Array[], password: string): Uint8Array;
  export function decompress_7z(data: Uint8Array, password: string): Array<{ name: string; data: Uint8Array }>;
  export function validate_7z(data: Uint8Array): boolean;
  export function wasm_derive_key(password: Uint8Array, salt: Uint8Array): Uint8Array;
  export function wasm_generate_secret(): string;
  export function wasm_generate_ikm(): Uint8Array;
  export class WasmKeychain {
    constructor();
    static fromPassword(password: string): WasmKeychain;
    setPassword(password: string): void;
    generateSecret(): string;
    encryptMetadata(metadata: string): Uint8Array;
    decryptMetadata(data: Uint8Array): string;
    sign(data: Uint8Array): Uint8Array;
    verify(data: Uint8Array, signature: Uint8Array): boolean;
    exportAuthKey(): Uint8Array;
    salt(): Uint8Array;
    ikm(): Uint8Array;
  }
  export default function(): Promise<void>;
}
