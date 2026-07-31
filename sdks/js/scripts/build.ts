import * as esbuild from 'esbuild';
import { rimraf } from 'rimraf';
import wasmCompressPlugin from '../plugins/esbuild-plugin-wasm-compress.js';

await rimraf('dist');

await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'esm',
    platform: 'browser',
    outfile: 'dist/index.min.js',
    plugins: [wasmCompressPlugin],
});
