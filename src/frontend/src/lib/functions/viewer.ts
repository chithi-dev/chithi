const isTextMime = (mime: string) =>
	mime.startsWith('text/') ||
	mime === 'application/json' ||
	mime === 'application/xml' ||
	mime === 'text/xml';

const looksLikeText = (bytes: Uint8Array) => {
	let suspicious = 0;
	let total = 0;

	for (const byte of bytes) {
		total += 1;
		if (byte === 0x00) return false;
		if ((byte < 0x09 || byte > 0x0d) && byte < 0x20) suspicious += 1;
	}

	return total > 0 && suspicious / total < 0.1;
};

// We export a function that takes a file entry text and check if it's a viewable code text
export async function createViewableText(
	blob: Blob,
	_filename: string,
	mimeHint: string | null = null
): Promise<string | null> {
	const mime = mimeHint ?? (blob.type || null);

	if (mime && isTextMime(mime)) {
		return blob.text();
	}

	const header = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
	if (looksLikeText(header)) return blob.text();

	return null;
}
