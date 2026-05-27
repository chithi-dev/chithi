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

// Vite resolves these WASM URLs at build time.
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

// Track initialized codecs to avoid redundant WASM loads.
const initialized = new Set<string>();

const ensureInit = async (name: string, initFn: () => Promise<unknown>) => {
	if (initialized.has(name)) return;
	await initFn();
	initialized.add(name);
};

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
		await ensureInit('resvg', () => initResvg(resvgWasmUrl));
		const resvg = new Resvg(text);
		const pngBuffer = resvg.render().asPng().buffer as ArrayBuffer;
		const pngBlob = new Blob([pngBuffer], { type: 'image/png' });
		const imageBitmap = await createImageBitmap(pngBlob);
		return imageBitmapToImageData(imageBitmap);
	}

	if (!blob) throw new Error('No blob provided for decoding');

	const buffer = await blob.arrayBuffer();

	switch (type) {
		case 'heic':
		case 'heif': {
			await ensureInit('heic', () => initHeic({ locateFile: () => heicWasmUrl }));
			return decodeHeic(buffer);
		}
		case 'jxr': {
			await ensureInit('jxr', () => initJxr({ locateFile: () => jxrWasmUrl }));
			return decodeJxr(buffer);
		}
		case 'avif': {
			await ensureInit('avif-dec', () => initAvifDec({ locateFile: () => avifDecWasmUrl }));
			const decoded = await decodeAvif(buffer);
			if (!decoded) throw new Error('AVIF decoding failed');
			return decoded;
		}
		case 'webp': {
			await ensureInit('webp-dec', () => initWebpDec({ locateFile: () => webpDecWasmUrl }));
			return decodeWebp(buffer);
		}
		case 'jxl': {
			await ensureInit('jxl-dec', () => initJxlDec({ locateFile: () => jxlDecWasmUrl }));
			return decodeJxl(buffer);
		}
		case 'qoi': {
			await ensureInit('qoi-dec', () => initQoiDec({ locateFile: () => qoiDecWasmUrl }));
			return decodeQoi(buffer);
		}
		default:
			// Fallback to browser decoding for PNG, JPEG, GIF, etc.
			const imageBitmap = await createImageBitmap(blob);
			return imageBitmapToImageData(imageBitmap);
	}
}

const postMessage = (msg: unknown, transfer?: Transferable[]) =>
	(self as Window & typeof globalThis as unknown as Worker).postMessage(msg, { transfer });

self.addEventListener('message', async (event) => {
	const { type, toType = 'image/png', blob, text, optimize = false } = event.data;

	try {
		let outputBuffer: ArrayBuffer | null = null;

		if ((type === toType || (type === 'png' && toType === 'image/png')) && !optimize && blob) {
			outputBuffer = await blob.arrayBuffer();
		} else {
			const imageData = await decodeToImageData(type, blob, text);

			switch (toType) {
				case 'image/png': {
					await ensureInit('png-enc', () => initPngEnc(pngEncWasmUrl));
					outputBuffer = await encodePng(imageData) as ArrayBuffer;
					break;
				}
				case 'image/webp': {
					await ensureInit('webp-enc', () => initWebpEnc({ locateFile: () => webpEncWasmUrl }));
					outputBuffer = await encodeWebp(imageData) as ArrayBuffer;
					break;
				}
				case 'image/avif': {
					await ensureInit('avif-enc', () => initAvifEnc({ locateFile: () => avifEncWasmUrl }));
					outputBuffer = await encodeAvif(imageData) as ArrayBuffer;
					break;
				}
				case 'image/jxl': {
					await ensureInit('jxl-enc', () => initJxlEnc({ locateFile: () => jxlEncWasmUrl }));
					outputBuffer = await encodeJxl(imageData) as ArrayBuffer;
					break;
				}
				case 'image/qoi': {
					await ensureInit('qoi-enc', () => initQoiEnc({ locateFile: () => qoiEncWasmUrl }));
					outputBuffer = await encodeQoi(imageData) as ArrayBuffer;
					break;
				}
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
			if (toType === 'image/png' && optimize) {
				postMessage({ type: 'status', status: 'optimizing' });

				await ensureInit('oxipng', () => initOxipng(oxipngWasmUrl));
				const optimizedBuffer = await optimisePng(outputBuffer, { level: 3 });
				outputBuffer = optimizedBuffer as ArrayBuffer;
			}

			const resultBlob = new Blob([outputBuffer], { type: toType });
			const transferList = outputBuffer instanceof ArrayBuffer ? [outputBuffer] : [];

			postMessage(
				{
					type: 'success',
					outputBlob: resultBlob,
					outputMime: toType
				},
				transferList
			);
		} else {
			throw new Error('Conversion failed: No output buffer produced');
		}
	} catch (error) {
		postMessage({
			type: 'error',
			message: (error as Error).message ?? String(error)
		});
	}
});
