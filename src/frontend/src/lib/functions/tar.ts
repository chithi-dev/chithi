export function pad(input: string, length: number) {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const out = new Uint8Array(length);
	out.fill(0);
	out.set(data.subarray(0, Math.min(data.length, length)));
	return out;
}

function writeString(buffer: Uint8Array, offset: number, str: string, length: number) {
	buffer.set(pad(str, length), offset);
}

function numberToOctal(value: number, length: number) {
	// returns ASCII octal representation, padded with leading zeros, leaving last byte for null
	const oct = value.toString(8);
	const padded = oct.padStart(length - 1, '0') + '\0';
	return padded;
}

export function createTarHeader(file: File): Uint8Array {
	const path = ((file as any).relativePath as string) || file.name;
	const header = new Uint8Array(512);
	// name (100)
	let name = path;
	let prefix = '';
	if (name.length > 100) {
		// try to split into prefix (155) and name (100)
		const idx = name.length > 255 ? -1 : name.lastIndexOf('/', 255 - 100);
		if (idx > 0 && idx < name.length) {
			prefix = name.slice(0, idx);
			name = name.slice(idx + 1);
		}
		// fallback: truncate
		if (name.length > 100) name = name.slice(0, 100);
		if (prefix.length > 155) prefix = prefix.slice(0, 155);
	}

	writeString(header, 0, name, 100);
	writeString(header, 100, numberToOctal(0o644, 8), 8); // mode
	writeString(header, 108, numberToOctal(0, 8), 8); // uid
	writeString(header, 116, numberToOctal(0, 8), 8); // gid
	writeString(header, 124, numberToOctal(file.size, 12), 12); // size
	writeString(header, 136, numberToOctal(Math.floor(Date.now() / 1000), 12), 12); // mtime
	// checksum field — fill with spaces for calculation
	writeString(header, 148, '        ', 8);
	writeString(header, 156, '0', 1); // typeflag '0' regular file
	writeString(header, 257, 'ustar\0', 6); // magic
	writeString(header, 263, '00', 2); // version
	writeString(header, 265, '', 32); // uname
	writeString(header, 297, '', 32); // gname
	writeString(header, 329, '', 8); // devmajor
	writeString(header, 337, '', 8); // devminor
	writeString(header, 345, prefix, 155); // prefix

	// compute checksum
	let sum = 0;
	for (let i = 0; i < 512; i++) sum += header[i];
	// checksum is written as octal in 6 bytes, followed by \0 and space
	const chks = sum.toString(8).padStart(6, '0') + '\0 ';
	writeString(header, 148, chks, 8);

	return header;
}

export async function createTar(files: File[]): Promise<Blob> {
	const parts: Uint8Array[] = [];

	for (const file of files) {
		const fileBuf = new Uint8Array(await file.arrayBuffer());
		const header = createTarHeader(file);

		parts.push(header);
		parts.push(fileBuf);
		// pad file to 512
		if (fileBuf.length % 512 !== 0) {
			parts.push(new Uint8Array(512 - (fileBuf.length % 512)));
		}
	}

	// two 512 zero blocks at end
	parts.push(new Uint8Array(512));
	parts.push(new Uint8Array(512));

	// Convert Uint8Array parts to ArrayBuffers where needed to satisfy Blob constructor typing
	const blobParts = parts.map((p) => (p instanceof Uint8Array ? p.buffer : p)) as BlobPart[];
	return new Blob(blobParts, { type: 'application/x-tar' });
}
