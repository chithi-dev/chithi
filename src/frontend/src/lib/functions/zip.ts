const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	CRC_TABLE[i] = c;
}

export function crc32(buf: Uint8Array, previous: number = 0): number {
	let crc = previous ^ -1;
	for (let i = 0; i < buf.length; i++) {
		crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
	}
	return crc ^ -1;
}

export interface ZipFileEntry {
	name: string;
	compressedSize: number;
	uncompressedSize: number;
	crc: number;
	offset: number;
	lastModified: Date;
	compressionMethod: number;
}

export function createLocalFileHeader(
	name: string,
	extraLen: number = 0,
	lastModified: Date,
	compressionMethod: number = 0
): Uint8Array {
	const encoder = new TextEncoder();
	const nameBytes = encoder.encode(name);
	const buf = new Uint8Array(30 + nameBytes.length + extraLen);
	const view = new DataView(buf.buffer);

	view.setUint32(0, 0x04034b50, true); // Signature
	view.setUint16(4, 0x0014, true); // Version needed (2.0)
	view.setUint16(6, 0x0808, true); // Flags (bit 3 set for data descriptor, bit 11 for UTF-8)
	view.setUint16(8, compressionMethod, true); // Compression

	// Time/Date
	const time =
		(lastModified.getHours() << 11) |
		(lastModified.getMinutes() << 5) |
		(lastModified.getSeconds() >> 1);
	const dateVal =
		((lastModified.getFullYear() - 1980) << 9) |
		((lastModified.getMonth() + 1) << 5) |
		lastModified.getDate();

	view.setUint16(10, time, true);
	view.setUint16(12, dateVal, true);

	view.setUint32(14, 0, true); // CRC32 (0 for now)
	view.setUint32(18, 0, true); // Compressed Size (0)
	view.setUint32(22, 0, true); // Uncompressed Size (0)

	view.setUint16(26, nameBytes.length, true); // Filename length
	view.setUint16(28, extraLen, true); // Extra field length

	buf.set(nameBytes, 30);
	return buf;
}

export function createDataDescriptor(
	crc: number,
	compressedSize: number,
	uncompressedSize: number
): Uint8Array {
	const buf = new Uint8Array(16);
	const view = new DataView(buf.buffer);
	view.setUint32(0, 0x08074b50, true); // Signature
	view.setUint32(4, crc, true);
	view.setUint32(8, compressedSize, true);
	view.setUint32(12, uncompressedSize, true);
	return buf;
}

export function createCentralDirectoryHeader(entry: ZipFileEntry): Uint8Array {
	const encoder = new TextEncoder();
	const nameBytes = encoder.encode(entry.name);
	const buf = new Uint8Array(46 + nameBytes.length);
	const view = new DataView(buf.buffer);

	view.setUint32(0, 0x02014b50, true); // Signature
	view.setUint16(4, 0x0014, true); // Version made by
	view.setUint16(6, 0x0014, true); // Version needed
	view.setUint16(8, 0x0808, true); // Flags (bit 3, bit 11)
	view.setUint16(10, entry.compressionMethod, true); // Compression

	// Time/Date
	const date = entry.lastModified;
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const dateVal =
		((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

	view.setUint16(12, time, true);
	view.setUint16(14, dateVal, true);

	view.setUint32(16, entry.crc, true);
	view.setUint32(20, entry.compressedSize, true);
	view.setUint32(24, entry.uncompressedSize, true);

	view.setUint16(28, nameBytes.length, true);
	view.setUint16(30, 0, true); // Extra field length
	view.setUint16(32, 0, true); // Comment length
	view.setUint16(34, 0, true); // Disk number start
	view.setUint16(36, 0, true); // Internal file attributes
	view.setUint32(38, 0, true); // External file attributes
	view.setUint32(42, entry.offset, true); // Relative offset of LFH

	buf.set(nameBytes, 46);
	return buf;
}

export function createEndOfCentralDirectory(
	numEntries: number,
	cdSize: number,
	cdOffset: number
): Uint8Array {
	const buf = new Uint8Array(22);
	const view = new DataView(buf.buffer);

	view.setUint32(0, 0x06054b50, true); // Signature
	view.setUint16(4, 0, true); // Disk number
	view.setUint16(6, 0, true); // Disk with CD
	view.setUint16(8, numEntries, true); // Entries on this disk
	view.setUint16(10, numEntries, true); // Total entries
	view.setUint32(12, cdSize, true); // Size of CD
	view.setUint32(16, cdOffset, true); // Offset of CD
	view.setUint16(20, 0, true); // Comment length

	return buf;
}
