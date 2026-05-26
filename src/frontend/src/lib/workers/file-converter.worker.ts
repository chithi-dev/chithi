import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

// #region discourse imports
import decodeHeic, { init as initHeic } from '@discourse/heic/decode';
import decodeJxr, { init as initJxr } from '@discourse/jxr/decode';
// #endregion

// #region jsquash imports
import decodeAvif, { init as initAvifDec } from '@jsquash/avif/decode';
import encodeAvif, { init as initAvifEnc } from '@jsquash/avif/encode';
import decodeJxl, { init as initJxlDec } from '@jsquash/jxl/decode';
import encodeJxl, { init as initJxlEnc } from '@jsquash/jxl/encode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import encodePng, { init as initPngEnc } from '@jsquash/png/encode';
import decodeQoi, { init as initQoiDec } from '@jsquash/qoi/decode';
import encodeQoi, { init as initQoiEnc } from '@jsquash/qoi/encode';
import decodeWebp, { init as initWebpDec } from '@jsquash/webp/decode';
import encodeWebp, { init as initWebpEnc } from '@jsquash/webp/encode';
// #endregion

// Vite will resolve these WASM URLs at build time.
import heicWasmUrl from '@discourse/heic/codec/dec/heic_dec.wasm?url';
import jxrWasmUrl from '@discourse/jxr/codec/dec/jxr_dec.wasm?url';
import avifDecWasmUrl from '@jsquash/avif/codec/dec/avif_dec.wasm?url';
import avifEncWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import jxlDecWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url';
import jxlEncWasmUrl from '@jsquash/jxl/codec/enc/jxl_enc.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg-parallel/squoosh_oxipng_bg.wasm?url';
import pngEncWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import qoiDecWasmUrl from '@jsquash/qoi/codec/dec/qoi_dec.wasm?url';
import qoiEncWasmUrl from '@jsquash/qoi/codec/enc/qoi_enc.wasm?url';
import webpDecWasmUrl from '@jsquash/webp/codec/dec/webp_dec.wasm?url';
import webpEncWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';

let heicInitialized = false;
let jxrInitialized = false;
let avifDecInitialized = false;
let avifEncInitialized = false;
let jxlDecInitialized = false;
let jxlEncInitialized = false;
let pngEncInitialized = false;
let qoiDecInitialized = false;
let qoiEncInitialized = false;
let webpDecInitialized = false;
let webpEncInitialized = false;
let oxipngInitialized = false;
let resvgInitialized = false;

async function imageBitmapToImageData(imageBitmap: ImageBitmap): Promise<ImageData> {
	const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');
	ctx.drawImage(imageBitmap, 0, 0);
	return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
}

async function decodeToImageData(
	type: string,
	blob: Blob | null,
	text: string | null
): Promise<ImageData> {
	if (type === 'svg' && text) {
		if (!resvgInitialized) {
			await initResvg(resvgWasmUrl);
			resvgInitialized = true;
		}
		const resvg = new Resvg(text);
		const pngBuffer = resvg.render().asPng().buffer as ArrayBuffer;
		const pngBlob = new Blob([pngBuffer], { type: 'image/png' });
		const imageBitmap = await createImageBitmap(pngBlob);
		return imageBitmapToImageData(imageBitmap);
	}

	if (!blob) throw new Error('No blob provided for decoding');

	const buffer = await blob.arrayBuffer();

	if (type === 'heic' || type === 'heif') {
		if (!heicInitialized) {
			await initHeic({ locateFile: () => heicWasmUrl });
			heicInitialized = true;
		}
		return await decodeHeic(buffer);
	}

	if (type === 'jxr') {
		if (!jxrInitialized) {
			await initJxr({ locateFile: () => jxrWasmUrl });
			jxrInitialized = true;
		}
		return await decodeJxr(buffer);
	}

	if (type === 'avif') {
		if (!avifDecInitialized) {
			await initAvifDec({ locateFile: () => avifDecWasmUrl });
			avifDecInitialized = true;
		}
		const decoded = await decodeAvif(buffer);
		if (!decoded) throw new Error('AVIF decoding failed');
		return decoded;
	}

	if (type === 'webp') {
		if (!webpDecInitialized) {
			await initWebpDec({ locateFile: () => webpDecWasmUrl });
			webpDecInitialized = true;
		}
		return await decodeWebp(buffer);
	}

	if (type === 'jxl') {
		if (!jxlDecInitialized) {
			await initJxlDec({ locateFile: () => jxlDecWasmUrl });
			jxlDecInitialized = true;
		}
		return await decodeJxl(buffer);
	}

	if (type === 'qoi') {
		if (!qoiDecInitialized) {
			await initQoiDec({ locateFile: () => qoiDecWasmUrl });
			qoiDecInitialized = true;
		}
		return await decodeQoi(buffer);
	}

	// Fallback to browser decoding for PNG, JPEG, GIF, etc.
	const imageBitmap = await createImageBitmap(blob);
	return imageBitmapToImageData(imageBitmap);
}

self.addEventListener('message', async (event) => {
	const { type, toType = 'image/png', blob, text, optimize = false } = event.data;
	try {
		let outputBuffer: ArrayBuffer | null = null;
		const outputMime = toType;

		// If source is same as target and no optimization requested, just return the blob
		if (
			(type === toType || (type === 'png' && toType === 'image/png')) &&
			!optimize &&
			blob
		) {
			outputBuffer = await blob.arrayBuffer();
		} else {
			const imageData = await decodeToImageData(type, blob, text);

			if (toType === 'image/png') {
				if (!pngEncInitialized) {
					await initPngEnc(pngEncWasmUrl);
					pngEncInitialized = true;
				}
				outputBuffer = await encodePng(imageData) as ArrayBuffer;
			} else if (toType === 'image/webp') {
				if (!webpEncInitialized) {
					await initWebpEnc({ locateFile: () => webpEncWasmUrl });
					webpEncInitialized = true;
				}
				outputBuffer = await encodeWebp(imageData) as ArrayBuffer;
			} else if (toType === 'image/avif') {
				if (!avifEncInitialized) {
					await initAvifEnc({ locateFile: () => avifEncWasmUrl });
					avifEncInitialized = true;
				}
				outputBuffer = await encodeAvif(imageData) as ArrayBuffer;
			} else if (toType === 'image/jxl') {
				if (!jxlEncInitialized) {
					await initJxlEnc({ locateFile: () => jxlEncWasmUrl });
					jxlEncInitialized = true;
				}
				outputBuffer = await encodeJxl(imageData) as ArrayBuffer;
			} else if (toType === 'image/qoi') {
				if (!qoiEncInitialized) {
					await initQoiEnc({ locateFile: () => qoiEncWasmUrl });
					qoiEncInitialized = true;
				}
				outputBuffer = await encodeQoi(imageData) as ArrayBuffer;
			}
		}

		if (outputBuffer) {
			if (outputMime === 'image/png' && optimize) {
				self.postMessage({ type: 'status', status: 'optimizing' });

				if (!oxipngInitialized) {
					await initOxipng(oxipngWasmUrl);
					oxipngInitialized = true;
				}
				const optimizedBuffer = await optimisePng(outputBuffer, { level: 3 });
				outputBuffer = optimizedBuffer as ArrayBuffer;
			}

			const resultBlob = new Blob([outputBuffer!], { type: outputMime });
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
