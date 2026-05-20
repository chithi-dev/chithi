import { getMimeType } from './mime';

// We export a function that takes a file entry text and check if it's a viewable code text
function isTextMime(mime: string) {
	return (
		mime.startsWith('text/') ||
		mime === 'application/json' ||
		mime === 'application/xml' ||
		mime === 'text/xml'
	);
}

function looksLikeText(bytes: Uint8Array) {
	let suspicious = 0;
	let total = 0;

	for (const byte of bytes) {
		total += 1;
		if (byte === 0x00) return false;
		if ((byte < 0x09 || byte > 0x0d) && byte < 0x20) suspicious += 1;
	}

	return total > 0 && suspicious / total < 0.1;
}

// We export a function that takes a file entry text and check if it's a viewable code text
export async function createViewableText(
	blob: Blob,
	filename: string,
	mimeHint: string | null = null
): Promise<string | null> {
	const mime = mimeHint ?? getMimeType(filename);

	if (isTextMime(mime)) {
		return blob.text();
	}

	if (!mimeHint || mime === 'application/octet-stream') {
		const header = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
		if (looksLikeText(header)) return blob.text();
	}

	return null;
}
