export async function gzipBlob(blob: Blob): Promise<Blob> {
	// Use native CompressionStream when available (modern browsers)
	const CompressionStreamCtor = (globalThis as any).CompressionStream;
	if (CompressionStreamCtor) {
		const cs = new CompressionStreamCtor('gzip');
		const gzStream = blob.stream().pipeThrough(cs);
		const gzBlob = await new Response(gzStream).blob();

		// Require DecompressionStream to validate compressed tar. If not available, reject so caller falls back to uncompressed tar
		const DecompressionStreamCtor = (globalThis as any).DecompressionStream;
		if (!DecompressionStreamCtor) {
			console.warn(
				'DecompressionStream not available — refusing to produce .tar.gz since it cannot be validated'
			);
			throw new Error('DecompressionStream not available to validate gzip');
		}

		try {
			const ds = new DecompressionStreamCtor('gzip');
			const decompressedStream = gzBlob.stream().pipeThrough(ds);
			const reader = decompressedStream.getReader();
			let got = 0;
			const needed = 512; // read at least the first header block
			const buf = new Uint8Array(needed);
			while (got < needed) {
				const res = await reader.read();
				if (res.done) break;
				const value: any = res.value;
				let chunk: Uint8Array;
				if (value instanceof Uint8Array) chunk = value;
				else if (value instanceof ArrayBuffer) chunk = new Uint8Array(value);
				else if (value && value.buffer instanceof ArrayBuffer) chunk = new Uint8Array(value.buffer);
				else chunk = new Uint8Array(Array.from(value || []));
				buf.set(chunk.subarray(0, Math.min(chunk.length, needed - got)), got);
				got += chunk.length;
			}
			reader.releaseLock();

			// check magic at offset 257
			const magic = String.fromCharCode(...buf.slice(257, 263));
			if (magic !== 'ustar\0') {
				throw new Error('gzip produced invalid tar on roundtrip validation');
			}
		} catch (err) {
			console.warn('Gzip roundtrip validation failed', err);
			throw err; // let caller fallback to uncompressed tar
		}

		return gzBlob;
	}

	// If not available, throw so callers can fallback gracefully
	throw new Error('CompressionStream not available in this environment');
}
