import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN_NAME = 'wasm-compress';

export default {
    name: PLUGIN_NAME,
    setup(build) {
        const { onResolve, onLoad } = build;

        onResolve({ filter: /\.wasm$/ }, (args) => {
            const wasmPath = path.resolve(args.resolveDir, args.path);
            return {
                path: args.path,
                namespace: PLUGIN_NAME,
                pluginData: wasmPath,
            };
        });

        onLoad({ filter: /\.wasm$/, namespace: PLUGIN_NAME }, async (args) => {
            const wasmPath = args.pluginData;
            const wasmBytes = fs.readFileSync(wasmPath);
            const compressed = zlib.brotliCompressSync(wasmBytes, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });

            const hex = compressed.toString('hex');
            const chunks = [];
            const chunkSize = 1024;
            for (let i = 0; i < hex.length; i += chunkSize) {
                chunks.push(hex.slice(i, i + chunkSize));
            }

            const js = `
const compressedHex = [
    ${chunks.map((c) => `"${c}"`).join(',\n    ')}
].join('');

export default Uint8Array.from(
    compressedHex.match(/.{1,2}/g).map(h => parseInt(h, 16))
);
`;
            return { contents: js, loader: 'js' };
        });
    },
};
