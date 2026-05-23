import decodeJxl, { init as initJxl } from '@jsquash/jxl/decode';
import encodePng, { init as initPng } from '@jsquash/png/encode';
import optimisePng, { init as initOxipng } from '@jsquash/oxipng/optimise';
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm';

let jxlInitialized = false;
let pngInitialized = false;
let oxipngInitialized = false;
let resvgInitialized = false;

self.addEventListener('message', async (event) => {
	const { type, blob, text, wasmUrls } = event.data;

	try {
		let pngBuffer: ArrayBufferLike | null = null;

		if (type === 'jxl') {
			if (!jxlInitialized) {
				await initJxl({ locateFile: () => wasmUrls.jxl });
				jxlInitialized = true;
			}
			if (!pngInitialized) {
				await initPng(wasmUrls.png);
				pngInitialized = true;
			}
			const buffer = await blob.arrayBuffer();
			const imageData = await decodeJxl(buffer);
			pngBuffer = await encodePng(imageData);
		} else if (type === 'heic') {
			// heic-to might need to be imported dynamically to avoid issues
			const { heicTo } = await import('heic-to');
			const resultBlob = await heicTo({ blob, type: 'image/png' });
			pngBuffer = await resultBlob.arrayBuffer();
		} else if (type === 'svg') {
			if (!resvgInitialized) {
				await initResvg(wasmUrls.resvg);
				resvgInitialized = true;
			}
			const resvg = new Resvg(text);
			pngBuffer = resvg.render().asPng().buffer;
		} else if (type === 'png') {
			pngBuffer = await blob.arrayBuffer();
		}

		if (pngBuffer) {
			if (!oxipngInitialized) {
				await initOxipng(wasmUrls.oxipng);
				oxipngInitialized = true;
			}
			// Absolute best performance, no compromise: level 3 optimization
			const optimizedBuffer = await optimisePng(pngBuffer as ArrayBuffer, { level: 3 });

			const resultBlob = new Blob([optimizedBuffer], { type: 'image/png' });
			const transferList = optimizedBuffer instanceof ArrayBuffer ? [optimizedBuffer] : [];
			
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
