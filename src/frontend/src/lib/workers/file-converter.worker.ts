import decodeJxl, { init as initJxl } from '@jsquash/jxl/decode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import encodePng, { init as initPng } from '@jsquash/png/encode';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';
import { threads } from 'wasm-feature-detect';
// Vite will resolve these WASM URLs at build time.
import jxlWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import oxipngParallelWasmUrl from '@jsquash/oxipng/codec/pkg-parallel/squoosh_oxipng_bg.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';

let jxlInitialized = false;
let pngInitialized = false;
let oxipngInitialized = false;
let resvgInitialized = false;
let oxipngUrl: string | null = null;

self.addEventListener('message', async (event) => {
	const { type, blob, text, optimize = false } = event.data;
	try {
		let pngBuffer: ArrayBufferLike | null = null;

		// Resolve the correct oxipng WASM once, based on SharedArrayBuffer/thread support
		if (!oxipngUrl) {
			const hasThreads = await threads();
			oxipngUrl = hasThreads ? oxipngParallelWasmUrl : oxipngWasmUrl;
		}

		if (type === 'jxl') {
			if (!jxlInitialized) {
				await initJxl({ locateFile: () => jxlWasmUrl });
				jxlInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(pngWasmUrl);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeJxl(buffer);
			pngBuffer = await encodePng(imageData);
		} else if (type === 'heic') {
			const { heicTo } = await import('heic-to');
			const resultBlob = await heicTo({ blob, type: 'image/png' });
			pngBuffer = await resultBlob.arrayBuffer();
		} else if (type === 'svg') {
			if (!resvgInitialized) {
				await initResvg(resvgWasmUrl);
				resvgInitialized = true;
			}
			const resvg = new Resvg(text);
			pngBuffer = resvg.render().asPng().buffer;
		} else if (type === 'png') {
			pngBuffer = await blob.arrayBuffer();
		}

		if (pngBuffer) {
			if (optimize) {
				self.postMessage({ type: 'status', status: 'optimizing' });

				if (!oxipngInitialized) {
					await initOxipng(oxipngUrl);
					oxipngInitialized = true;
				}
				const optimizedBuffer = await optimisePng(pngBuffer as ArrayBuffer, { level: 3 });
				pngBuffer = optimizedBuffer;
			}

			const resultBlob = new Blob([pngBuffer as ArrayBuffer], { type: 'image/png' });

			const transferList = pngBuffer instanceof ArrayBuffer ? [pngBuffer] : [];

			(self as any).postMessage(
				{
					type: 'success',
					pngBlob: resultBlob
				},
				transferList
			);
		} else {
			throw new Error('Conversion failed: No PNG buffer produced');
		}
	} catch (error: any) {
		(self as any).postMessage({
			type: 'error',
			message: error.message || String(error)
		});
	}
});
