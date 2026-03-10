import { getMimeType } from './mime';

// We export a function that takes a file entry text and check if it's a viewable code text
export async function createViewableText(blob: Blob, filename: string): Promise<string | null> {
	const mime = getMimeType(filename);
	// Check if it's text, json, xml, or source code (heuristically by mime type or extension)
	if (
		mime.startsWith('text/') ||
		mime === 'application/json' ||
		mime === 'application/xml' ||
		filename.match(
			/\.(ts|js|jsx|tsx|svelte|py|java|c|cpp|rs|go|sh|md|css|scss|html|yaml|yml|json|xml|sql)$/i
		)
	) {
		const text = await blob.text();
		return text;
	}

	return null;
}
