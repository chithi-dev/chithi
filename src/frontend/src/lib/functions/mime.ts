export function detectMimeFromBytes(bytes: Uint8Array): string | null {
	const has = (offset: number, ...header: number[]) =>
		header.every((v, i) => bytes.at(offset + i) === v);

	// #region image formats
	if (has(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
	if (has(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (has(0, 0xff, 0x0a)) return 'image/jxl';
	if (has(0, 0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a))
		return 'image/jxl';
	if (has(0, 0x71, 0x6f, 0x69, 0x66)) return 'image/qoi';
	if (has(0, 0x49, 0x49, 0xbc)) return 'image/jxr';
	if (has(0, 0x4d, 0x4d, 0x00, 0xbc)) return 'image/jxr';
	if (has(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
	if (has(0, 0x49, 0x49, 0x2a, 0x00) || has(0, 0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff';
	if (has(0, 0x42, 0x4d)) return 'image/bmp';
	if (has(0, 0x4f, 0x52, 0x07, 0x00, 0x73, 0x00, 0x61, 0x76)) return 'image/x-icon';
	if (has(0, 0x00, 0x00, 0x01, 0x00)) return 'image/x-icon';
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	// #endregion

	// #region document formats
	if (has(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
	// #endregion

	// #region video formats
	if (has(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
	if (has(0, 0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70)) return 'video/mp4';
	if (has(4, 0x66, 0x74, 0x79, 0x70)) {
		const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
		if (brand === 'avif' || brand === 'avis') return 'image/avif';
		if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx')
			return 'image/heic';
		if (brand === 'mif1' || brand === 'msf1') return 'image/heif';
		if (brand === 'm4a ' || brand === 'm4b ' || brand === 'm4p ') return 'audio/mp4';
		if (brand === 'qt  ') return 'video/quicktime';
		return 'video/mp4';
	}
	if (bytes[0] === 0x47 && has(188, 0x47)) return 'video/mpeg';
	// #endregion

	// #region audio formats
	if (has(0, 0x4f, 0x67, 0x67, 0x53)) return 'audio/ogg';
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x41, 0x56, 0x45)) return 'audio/wav';
	if (has(0, 0x66, 0x4c, 0x61, 0x43)) return 'audio/flac';
	if (has(0, 0x49, 0x44, 0x33)) return 'audio/mpeg';
	if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';
	if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';
	if (has(0, 0x4d, 0x54, 0x68, 0x64)) return 'audio/midi';
	// #endregion

	// #region archive formats
	if (has(0, 0x50, 0x4b, 0x03, 0x04) || has(0, 0x50, 0x4b, 0x05, 0x06)) return 'application/zip';
	if (has(0, 0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return 'application/x-rar-compressed';
	if (has(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return 'application/x-7z-compressed';
	// #endregion

	// #region text-based formats
	const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

	if (/<svg[\s>]/i.test(textSample)) return 'image/svg+xml';
	if (/<!doctype\s*html/i.test(textSample) || /^<\?xml/i.test(textSample)) return 'text/html';
	if (/^\s*<[hH][tT][mM][lL]/.test(textSample)) return 'text/html';
	if (/^\s*<\?xml\s/.test(textSample)) return 'application/xml';

	const trimmed = textSample.trimStart();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'application/json';
	if (/^\s*@charset\s/i.test(textSample) || /^\s*\/\*/.test(textSample)) return 'text/css';
	// #endregion

	return null;
}

export async function detectMimeFromBlob(blob: Blob, sampleSize = 2048) {
	if (!blob.size) return null;
	const buffer = await blob.slice(0, sampleSize).arrayBuffer();
	return detectMimeFromBytes(new Uint8Array(buffer));
}

export async function detectMimeFromBlobWithFallback(blob: Blob, sampleSize = 2048) {
	if (!blob.size) return null;
	const blobType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : null;
	if (blobType) return blobType;
	return detectMimeFromBlob(blob, sampleSize);
}
