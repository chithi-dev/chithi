export function detectMimeFromBytes(bytes: Uint8Array): string | null {
	const has = (offset: number, ...header: number[]) =>
		header.every((v, i) => bytes.at(offset + i) === v);

	// #region image formats
	if (has(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';

	// JPEG / JFIF — all start with FF D8 FF
	if (has(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';

	if (has(0, 0xff, 0x0a)) return 'image/jxl';
	if (has(0, 0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a))
		return 'image/jxl';

	if (has(0, 0x71, 0x6f, 0x69, 0x66)) return 'image/qoi';
	if (has(0, 0x49, 0x49, 0xbc)) return 'image/jxr'; // little-endian
	if (has(0, 0x4d, 0x4d, 0x00, 0xbc)) return 'image/jxr'; // big-endian

	// GIF87a or GIF89a — both share the same magic; version byte at offset 3 is '7' or '9'
	if (has(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';

	// TIFF — little-endian (II) or big-endian (MM)
	if (has(0, 0x49, 0x49, 0x2a, 0x00) || has(0, 0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff';

	if (has(0, 0x42, 0x4d)) return 'image/bmp'; // Windows BMP/DIB
	if (has(0, 0x4f, 0x52, 0x07, 0x00, 0x73, 0x00, 0x61, 0x76)) return 'image/x-icon'; // ICO
	if (has(0, 0x00, 0x00, 0x01, 0x00)) return 'image/x-icon';

	// WebP — chunk-based format; any VP8/VP8L/VP8Z sub-type under RIFF is WebP
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	// #endregion

	// #region document formats
	if (has(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF-
	// #endregion

	// #region video formats
	if (has(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'; // EBML header
	if (has(0, 0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70)) return 'video/mp4'; // ftyp brand
	if (has(4, 0x66, 0x74, 0x79, 0x70)) {
		const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
		if (brand === 'avif' || brand === 'avis') return 'image/avif';
		if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx')
			return 'image/heic';
		if (brand === 'mif1' || brand === 'msf1') return 'image/heif';
		if (brand === 'm4a ' || brand === 'm4b ' || brand === 'm4p ') return 'audio/mp4';
		if (brand === 'qt  ') return 'video/quicktime'; // MOV
		return 'video/mp4';
	}

	// MPEG-TS / TS container — sync byte every 188 bytes
	if (bytes[0] === 0x47 && has(188, 0x47)) return 'video/mpeg';
	// #endregion

	// #region audio formats
	if (has(0, 0x4f, 0x67, 0x67, 0x53)) return 'audio/ogg'; // OGG Vorbis/Theora
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x41, 0x56, 0x45)) return 'audio/wav';
	if (has(0, 0x66, 0x4c, 0x61, 0x43)) return 'audio/flac'; // FLAC signature

	// MP3 — ID3v2 tag or raw MPEG-1/2 audio frame
	if (has(0, 0x49, 0x44, 0x33)) return 'audio/mpeg';
	if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';

	// AAC — ADTS header
	if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';

	// MIDI / SMF — 'MThd' signature
	if (has(0, 0x4d, 0x54, 0x68, 0x64)) return 'audio/midi';
	// #endregion

	// #region archive formats
	// ZIP — PK\003\004 or empty-archive PK\005\006
	if (has(0, 0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
	if (has(0, 0x50, 0x4b, 0x05, 0x06)) return 'application/zip';

	// RAR — 'Rar!\x1a\x07'
	if (has(0, 0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return 'application/x-rar-compressed';

	// 7z — magic '7z\xbc\xaf\x27\x1c'
	if (has(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return 'application/x-7z-compressed';
	// #endregion

	// #region text-based formats
	const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

	if (/<svg[\s>]/i.test(textSample)) return 'image/svg+xml';

	// HTML / XHTML — doctype or html root element
	if (/<!doctype\s*html/i.test(textSample) || /^<\?xml/i.test(textSample)) return 'text/html';
	if (/^\s*<[hH][tT][mM][lL]/.test(textSample)) return 'text/html';

	// XML declaration
	if (/^\s*<\?xml\s/.test(textSample)) return 'application/xml';

	// JSON — arrays and objects at file start
	const trimmed = textSample.trimStart();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'application/json';

	// CSS — @charset or common at-rules / comment block
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
	const buffer = await blob.slice(0, sampleSize).arrayBuffer();
	return detectMimeFromBytes(new Uint8Array(buffer));
}
