const mimeMap: Record<string, string> = {
	// Images
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	avif: 'image/avif',
	heic: 'image/heic',
	heif: 'image/heif',
	jxl: 'image/jxl',
	qoi: 'image/qoi',
	jxr: 'image/jxr',
	hdp: 'image/jxr',
	wdp: 'image/jxr',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	jfif: 'image/jpeg',
	// PDF
	pdf: 'application/pdf',
	// Video
	mp4: 'video/mp4',
	webm: 'video/webm',
	ogv: 'video/ogg',
	mov: 'video/quicktime',
	// Audio
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	flac: 'audio/flac',
	// Text / code
	txt: 'text/plain',
	md: 'text/plain',
	json: 'application/json',
	js: 'text/javascript',
	ts: 'text/plain',
	html: 'text/html',
	htm: 'text/html',
	css: 'text/css',
	xml: 'text/xml',
	csv: 'text/csv',
	log: 'text/plain',
	yaml: 'text/plain',
	yml: 'text/plain',
	ini: 'text/plain',
	conf: 'text/plain',
	sql: 'text/plain',
	py: 'text/plain',
	java: 'text/plain',
	c: 'text/plain',
	cpp: 'text/plain',
	h: 'text/plain',
	cs: 'text/plain',
	go: 'text/plain',
	rs: 'text/plain',
	php: 'text/plain',
	rb: 'text/plain',
	sh: 'text/plain',
	bat: 'text/plain',
	ps1: 'text/plain',
	env: 'text/plain',
	svelte: 'text/plain',
	scss: 'text/plain'
};

export function getMimeType(name: string): string {
	const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
	return mimeMap[ext] ?? 'application/octet-stream';
}

export function detectMimeFromBytes(bytes: Uint8Array): string | null {
	const has = (offset: number, ...header: number[]): boolean =>
		offset + header.length <= bytes.length &&
		header.every((value, index) => bytes[offset + index] === value);

	if (has(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
	if (has(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (has(0, 0xff, 0x0a)) return 'image/jxl';
	if (has(0, 0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a))
		return 'image/jxl';
	if (has(0, 0x71, 0x6f, 0x69, 0x66)) return 'image/qoi';
	if (has(0, 0x49, 0x49, 0xbc)) return 'image/jxr';
	if (has(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
	if (has(0, 0x42, 0x4d)) return 'image/bmp';
	if (has(0, 0x00, 0x00, 0x01, 0x00)) return 'image/x-icon';
	if (has(0, 0x49, 0x49, 0x2a, 0x00) || has(0, 0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff';
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
	if (has(0, 0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
	if (has(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
	if (has(0, 0x4f, 0x67, 0x67, 0x53)) return 'audio/ogg';
	if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x41, 0x56, 0x45)) return 'audio/wav';
	if (has(0, 0x66, 0x4c, 0x61, 0x43)) return 'audio/flac';
	if (has(0, 0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
		return 'audio/mpeg';
	if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'audio/aac';

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

	const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
	if (/<svg[\s>]/i.test(textSample)) return 'image/svg+xml';

	return null;
}

export async function detectMimeFromBlob(blob: Blob, sampleSize = 2048): Promise<string | null> {
	if (!blob.size) return null;
	const buffer = await blob.slice(0, sampleSize).arrayBuffer();
	return detectMimeFromBytes(new Uint8Array(buffer));
}
