import { execSync } from 'node:child_process';
import { cpSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as esbuild from 'esbuild';

const root = resolve(import.meta.dirname, '..');

// Clean dist/
rmSync('dist', { recursive: true, force: true });

// Compile TypeScript
execSync(`tsc --project ${root}/tsconfig.json`, { stdio: 'inherit' });

// Minify JS output with esbuild
const jsFiles = ['dist/index.js', 'dist/client.js', 'dist/serialize.js', 'dist/types.js', 'dist/wasm.js'];

for (const file of jsFiles) {
    try {
        const src = readFileSync(file, 'utf-8');
        await esbuild.build({
            stdin: {
                contents: src,
                resolveDir: resolve(root, 'js'),
                sourcefile: file,
            },
            outfile: file,
            minify: true,
            logLevel: 'silent',
            target: 'es2020',
            treeShaking: false,
        });
    } catch {
        console.warn(`Warning: failed to minify ${file}, keeping original.`);
    }
}

// Copy WASM to dist/
const wasmSrc = resolve(root, 'chithi.wasm');
try {
    cpSync(wasmSrc, 'dist/chithi.wasm');
} catch {
    console.warn('Warning: chithi.wasm not found — skip copy (dev mode).');
}
