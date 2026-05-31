const textMimes = new Set(['application/json', 'application/xml', 'text/xml']);

const isTextMime = (mime: string) => mime.startsWith('text/') || textMimes.has(mime);

const looksLikeText = (bytes: Uint8Array) => {
	let suspicious = 0;
	for (const byte of bytes) {
		if (byte === 0x00) return false;
		if ((byte < 0x09 || byte > 0x0d) && byte < 0x20) suspicious++;
	}
	return bytes.length > 0 && suspicious / bytes.length < 0.1;
};

export async function createViewableText(
	blob: Blob,
	_filename: string,
	mimeHint: string | null = null
) {
	const mime = mimeHint ?? (blob.type || null);
	if (mime && isTextMime(mime)) return blob.text();

	const header = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
	return looksLikeText(header) ? blob.text() : null;
}
