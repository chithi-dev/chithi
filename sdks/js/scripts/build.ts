import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

// Clean dist/
rmSync('dist', { recursive: true, force: true });

// Compile TypeScript
execSync(`tsc --project ${root}/tsconfig.json`, { stdio: 'inherit' });

// Copy WASM to dist/
const wasmSrc = resolve(root, 'chithi.wasm');
try {
    cpSync(wasmSrc, 'dist/chithi.wasm');
} catch {
    console.warn('Warning: chithi.wasm not found — skip copy (dev mode).');
}
