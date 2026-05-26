import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

// #region discourse imports
import decodeGif, { init as initGif } from '@discourse/gif/decode';
import decodeHeic, { init as initHeic } from '@discourse/heic/decode';
import decodeJxr, { init as initJxr } from '@discourse/jxr/decode';
// #endregion
// #region jsquash imports
import decodeJxl, { init as initJxl } from '@jsquash/jxl/decode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import encodePng, { init as initPng } from '@jsquash/png/encode';
import decodeQoi, { init as initQoi } from '@jsquash/qoi/decode';
import decodeWebp, { init as initWebp } from '@jsquash/webp/decode';
import encodeWebp, { init as initWebpEncode } from '@jsquash/webp/encode';
// #endregion

// Vite will resolve these WASM URLs at build time.
import gifWasmUrl from '@discourse/gif/codec/pkg/squoosh_gif_bg.wasm?url';
import heicWasmUrl from '@discourse/heic/codec/dec/heic_dec.wasm?url';
import jxrWasmUrl from '@discourse/jxr/codec/dec/jxr_dec.wasm?url';
import jxlWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg-parallel/squoosh_oxipng_bg.wasm?url';
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import qoiWasmUrl from '@jsquash/qoi/codec/dec/qoi_dec.wasm?url';
import webpWasmUrl from '@jsquash/webp/codec/dec/webp_dec.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';

let gifInitialized = false;
let heicInitialized = false;
let jxrInitialized = false;
let jxlInitialized = false;
let pngInitialized = false;
let qoiInitialized = false;
let webpInitialized = false;
let webpEncodeInitialized = false;
let oxipngInitialized = false;
let resvgInitialized = false;

self.addEventListener('message', async (event) => {
	const { type, blob, text, optimize = false } = event.data;
	try {
		let outputBuffer: ArrayBufferLike | null = null;
		let outputMime: 'image/png' | 'image/webp' = 'image/png';

		if (type === 'gif') {
			if (!gifInitialized) {
				await initGif(gifWasmUrl);
				gifInitialized = true;
			}
			if (!webpEncodeInitialized) {
				await initWebpEncode();
				webpEncodeInitialized = true;
			}
			if (optimize) {
				self.postMessage({ type: 'status', status: 'optimizing' });
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeGif(buffer);
			outputBuffer = await encodeWebp(
				imageData,
				optimize ? { quality: 75, method: 4 } : { quality: 90, method: 4 }
			);
			outputMime = 'image/webp';
		} else if (type === 'heic') {
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
			outputBuffer = await encodePng(imageData);
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
			outputBuffer = await encodePng(imageData);
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
			outputBuffer = await encodePng(imageData);
		} else if (type === 'webp') {
			if (!webpInitialized) {
				await initWebp({ locateFile: () => webpWasmUrl });
				webpInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(pngWasmUrl);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeWebp(buffer);
			outputBuffer = await encodePng(imageData);
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
			outputBuffer = await encodePng(imageData);
		} else if (type === 'svg') {
			if (!resvgInitialized) {
				await initResvg(resvgWasmUrl);
				resvgInitialized = true;
			}
			const resvg = new Resvg(text);
			outputBuffer = resvg.render().asPng().buffer;
		} else if (type === 'png') {
			outputBuffer = await blob.arrayBuffer();
		}

		if (outputBuffer) {
			if (outputMime === 'image/png' && optimize) {
				self.postMessage({ type: 'status', status: 'optimizing' });

				if (!oxipngInitialized) {
					await initOxipng(oxipngWasmUrl);
					oxipngInitialized = true;
				}
				const optimizedBuffer = await optimisePng(outputBuffer as ArrayBuffer, { level: 3 });
				outputBuffer = optimizedBuffer;
			}

			const resultBlob = new Blob([outputBuffer as ArrayBuffer], { type: outputMime });
			const transferList = outputBuffer instanceof ArrayBuffer ? [outputBuffer] : [];

			(self as any).postMessage(
				{
					type: 'success',
					outputBlob: resultBlob,
					outputMime
				},
				transferList
			);
		} else {
			throw new Error('Conversion failed: No output buffer produced');
		}
	} catch (error: any) {
		(self as any).postMessage({
			type: 'error',
			message: error.message || String(error)
		});
	}
});
