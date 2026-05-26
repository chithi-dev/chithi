import decodeHeic, { init as initHeic } from '@discourse/heic/decode';
import decodeJxr, { init as initJxr } from '@discourse/jxr/decode';
import decodeJxl, { init as initJxl } from '@jsquash/jxl/decode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import encodePng, { init as initPng } from '@jsquash/png/encode';
import decodeQoi, { init as initQoi } from '@jsquash/qoi/decode';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';
// Vite will resolve these WASM URLs at build time.
import heicWasmUrl from '@discourse/heic/codec/dec/heic_dec.wasm?url';
import jxrWasmUrl from '@discourse/jxr/codec/dec/jxr_dec.wasm?url';
import jxlWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg-parallel/squoosh_oxipng_bg.wasm?url';
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import qoiWasmUrl from '@jsquash/qoi/codec/dec/qoi_dec.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';

let heicInitialized = false;
let jxrInitialized = false;
let jxlInitialized = false;
let pngInitialized = false;
let qoiInitialized = false;
let oxipngInitialized = false;
let resvgInitialized = false;

self.addEventListener('message', async (event) => {
	const { type, blob, text, optimize = false } = event.data;
	try {
		let pngBuffer: ArrayBufferLike | null = null;

		if (type === 'heic') {
			if (!heicInitialized) {
				await initHeic({ locateFile: () => heicWasmUrl });
				heicInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(pngWasmUrl);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeHeic(buffer);
			pngBuffer = await encodePng(imageData);
		} else if (type === 'jxr') {
			if (!jxrInitialized) {
				await initJxr({ locateFile: () => jxrWasmUrl });
				jxrInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(pngWasmUrl);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeJxr(buffer);
			pngBuffer = await encodePng(imageData);
		} else if (type === 'qoi') {
			if (!qoiInitialized) {
				await initQoi({ locateFile: () => qoiWasmUrl });
				qoiInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(pngWasmUrl);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeQoi(buffer);
			pngBuffer = await encodePng(imageData);
		} else if (type === 'jxl') {
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
					await initOxipng(oxipngWasmUrl);
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
