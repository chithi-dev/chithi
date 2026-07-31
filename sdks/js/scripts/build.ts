import * as esbuild from 'esbuild';
import wasmCompressPlugin from '../plugins/esbuild-plugin-wasm-compress.js';

await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    outfile: 'dist/index.js',
    plugins: [wasmCompressPlugin],
});
