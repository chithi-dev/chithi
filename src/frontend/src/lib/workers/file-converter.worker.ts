import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

// #region discourse imports
import type { GIFFrame } from '@discourse/gif/decode';
import { decodeAnimated as gifDecodeAnimated, init as initGif } from '@discourse/gif/decode';
import decodeHeic, { init as initHeic } from '@discourse/heic/decode';
import decodeJxr, { init as initJxr } from '@discourse/jxr/decode';
// #endregion

// #region jsquash imports
import encodeAvif, { init as initAvifEnc } from '@jsquash/avif/encode';
import decodeQoi, { init as initQoiDec } from '@jsquash/qoi/decode';
import encodeQoi, { init as initQoiEnc } from '@jsquash/qoi/encode';
import encodeJxl, { init as initJxlEnc } from '@jsquash/jxl/encode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import encodePng, { init as initPngEnc } from '@jsquash/png/encode';
// #endregion

// #region discourse webp imports
import decodeWebp, { init as initWebpDec } from '@discourse/webp/decode';
import encodeWebp, {
	encodeAnimated as encodeWebpAnimated,
	init as initWebpEnc
} from '@discourse/webp/encode';
// #endregion

// Vite resolves these WASM URLs at build time.
import heicWasmUrl from '@discourse/heic/codec/dec/heic_dec.wasm?url';
import jxrWasmUrl from '@discourse/jxr/codec/dec/jxr_dec.wasm?url';
import webpDecWasmUrl from '@discourse/webp/codec/dec/webp_dec.wasm?url';
import webpEncWasmUrl from '@discourse/webp/codec/enc/webp_enc.wasm?url';
import avifEncWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import qoiDecWasmUrl from '@jsquash/qoi/codec/dec/qoi_dec.wasm?url';
import qoiEncWasmUrl from '@jsquash/qoi/codec/enc/qoi_enc.wasm?url';
import jxlEncWasmUrl from '@jsquash/jxl/codec/enc/jxl_enc.wasm?url';
import oxipngWasmUrl from '@jsquash/oxipng/codec/pkg-parallel/squoosh_oxipng_bg.wasm?url';
import pngEncWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';

// Track initialized codecs to avoid redundant WASM loads.
const initialized = new Set<string>();

const ensureInit = async (name: string, initFn: () => Promise<unknown>) => {
	if (initialized.has(name)) return;
	await initFn();
	initialized.add(name);
};

async function imageBitmapToImageData(imageBitmap: ImageBitmap) {
	const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
	let ctx: OffscreenCanvasRenderingContext2D | null = canvas.getContext('2d');
	ctx ??= (() => {
		throw new Error('Could not get 2d context from OffscreenCanvas');
	})();
	ctx.drawImage(imageBitmap, 0, 0);
	return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
}

async function decodeToImageData(
	type: string,
	blob: Blob | null,
	text: string | null
) {
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
		case 'webp': {
			await ensureInit('webp-dec', () => initWebpDec({ locateFile: () => webpDecWasmUrl }));
			const decoded =
				(await decodeWebp(buffer)) ??
				(() => {
					throw new Error('WebP decoding failed');
				})();
			return decoded;
		}
		case 'qoi': {
			await ensureInit('qoi-dec', () => initQoiDec({ locateFile: () => qoiDecWasmUrl }));
			return await decodeQoi(buffer);
		}
		case 'png':
		case 'jpeg':
		case 'bmp': {
			const imageBitmap = await createImageBitmap(blob);
			return imageBitmapToImageData(imageBitmap);
		}
		default:
			throw new Error(`Unsupported decode type: ${type}`);
	}
}

async function encodeGifToWebp(frames: GIFFrame[], optimize: boolean) {
	await ensureInit('webp-enc', () => initWebpEnc({ locateFile: () => webpEncWasmUrl }));
	return encodeWebpAnimated(
		frames.map((f) => ({ imageData: f.imageData, duration: Math.max(f.duration ?? 100, 100) })),
		optimize ? { quality: 75, method: 4 } : { quality: 90, method: 4 }
	);
}

async function encodeToImage(imageData: ImageData, toType: string): Promise<ArrayBuffer | null> {
	switch (toType) {
		case 'image/png': {
			await ensureInit('png-enc', () => initPngEnc(pngEncWasmUrl));
			return (await encodePng(imageData)) as ArrayBuffer;
		}
		case 'image/webp': {
			await ensureInit('webp-enc', () => initWebpEnc({ locateFile: () => webpEncWasmUrl }));
			return (await encodeWebp(
				imageData,
				optimize ? { quality: 75, method: 4 } : { quality: 90, method: 4 }
			)) as ArrayBuffer;
		}
		case 'image/avif': {
			await ensureInit('avif-enc', () => initAvifEnc({ locateFile: () => avifEncWasmUrl }));
			return (await encodeAvif(imageData)) as ArrayBuffer;
		}
		case 'image/qoi': {
			await ensureInit('qoi-enc', () => initQoiEnc({ locateFile: () => qoiEncWasmUrl }));
			return (await encodeQoi(imageData)) as ArrayBuffer;
		}
		case 'image/jxl': {
			await ensureInit('jxl-enc', () => initJxlEnc({ locateFile: () => jxlEncWasmUrl }));
			return (await encodeJxl(imageData)) as ArrayBuffer;
		}
		default:
			return null;
	}
}

let optimize = false;

const postMessage = (msg: unknown, transfer?: Transferable[]) =>
	(self as Window & typeof globalThis as unknown as Worker).postMessage(msg, { transfer });

self.addEventListener('message', async (event) => {
	const { type, toType = 'image/png', blob, text, opt } = event.data;
	optimize = opt ?? false;

	try {
		let outputBuffer: ArrayBuffer | null = null;
		let outputMime = '';

		if ((type === toType || (type === 'png' && toType === 'image/png')) && !optimize && blob) {
			outputBuffer ??= await blob.arrayBuffer();
		} else if (type === 'gif') {
			const buffer = blob!.arrayBuffer();
			let imageData: ImageData | null = null;

			try {
				await ensureInit('gif', initGif);
				const frames = (await gifDecodeAnimated(buffer)) ?? [];
				if (frames.length > 1) {
					// Animated GIF → animated WebP
					outputMime = 'image/webp';
					outputBuffer ??= await encodeGifToWebp(frames, optimize);
					for (const frame of frames) frame.free();
				} else if (frames.length === 1) {
					// Single-frame GIF → target format via ImageData
					imageData = frames[0].imageData;
					frames[0].free();
				}
			} catch {
				throw new Error('Failed to decode GIF');
			}

			if (outputBuffer === null && imageData) {
				outputBuffer ??= await encodeToImage(imageData, toType);
				outputMime ||= toType;
			}
		} else if (type === 'svg' && text) {
			await ensureInit('resvg', () => initResvg(resvgWasmUrl));

			const resvg = new Resvg(text);
			const pngBuffer = resvg.render().asPng().buffer as ArrayBuffer;
			const pngBlob = new Blob([pngBuffer], { type: 'image/png' });
			const imageBitmap = await createImageBitmap(pngBlob);
			const imageData = await imageBitmapToImageData(imageBitmap);

			if (toType === 'image/png') {
				outputBuffer ||= pngBuffer;
				outputMime = 'image/png';
				if (optimize) {
					postMessage({ type: 'status', status: 'optimizing' });
					await ensureInit('oxipng', () => initOxipng(oxipngWasmUrl));
					outputBuffer = (await optimisePng(pngBuffer, { level: 3 })) as ArrayBuffer;
				}
			} else if (toType === 'image/webp') {
				await ensureInit('webp-enc', () => initWebpEnc({ locateFile: () => webpEncWasmUrl }));
				outputBuffer ||= (await encodeWebp(imageData, optimize ? { quality: 75, method: 4 } : { quality: 90, method: 4 })) as ArrayBuffer;
				outputMime = 'image/webp';
			} else if (toType === 'image/avif') {
				await ensureInit('avif-enc', () => initAvifEnc({ locateFile: () => avifEncWasmUrl }));
				outputBuffer ||= (await encodeAvif(imageData)) as ArrayBuffer;
				outputMime = 'image/avif';
			} else if (toType === 'image/jxl') {
				await ensureInit('jxl-enc', () => initJxlEnc({ locateFile: () => jxlEncWasmUrl }));
				outputBuffer ||= (await encodeJxl(imageData)) as ArrayBuffer;
				outputMime = 'image/jxl';
			} else {
				const encoded = await encodeToImage(imageData, toType);
				if (encoded) {
					outputBuffer ||= encoded;
					outputMime = toType;
				}
			}
		} else if (type === 'svg' && !text && blob) {
			// SVG type with sourceBlob but no text — decode via ImageBitmap
			const imageBitmap = await createImageBitmap(blob);
			const imageData = await imageBitmapToImageData(imageBitmap);
			outputBuffer ??= await encodeToImage(imageData, toType);
			outputMime ||= toType;
		} else {
			const imageData = await decodeToImageData(type, blob, text);

			outputBuffer ??= await encodeToImage(imageData, toType);
			if (outputBuffer) outputMime = toType;

			if (!outputBuffer) {
				throw new Error(`Unsupported conversion to ${toType}`);
			}

			if (toType === 'image/png' && optimize) {
				postMessage({ type: 'status', status: 'optimizing' });
				await ensureInit('oxipng', () => initOxipng(oxipngWasmUrl));
				const originalBuffer = await blob!.arrayBuffer();
				outputBuffer ||= (await optimisePng(originalBuffer, { level: 3 })) as ArrayBuffer;
			}
		}

		if (outputBuffer) {
			const resultBlob = new Blob([outputBuffer], { type: outputMime });
			const transferList = outputBuffer instanceof ArrayBuffer ? [outputBuffer] : [];

			postMessage(
				{
					type: 'success',
					outputBlob: resultBlob,
					outputMime: outputMime || toType
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
