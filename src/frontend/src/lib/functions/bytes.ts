export const B_VALS = {
	Bytes: 1,
	KB: 1024,
	MB: 1024 ** 2,
	GB: 1024 ** 3,
	TB: 1024 ** 4
} as const;

export type ByteUnit = keyof typeof B_VALS;

const BYTE_UNITS = Object.keys(B_VALS) as ByteUnit[];

const byteInfo = (bytes: number): { val: number; unit: ByteUnit } => {
	const i = Math.floor(Math.log2(bytes) / 10);
	return { val: +(bytes / 1024 ** i).toFixed(2), unit: BYTE_UNITS[i] };
};

export const formatBytes = (bytes: number): { val: number; unit: ByteUnit } =>
	!bytes ? { val: 0, unit: 'MB' } : byteInfo(bytes);

export const bytesToNumber = (value: number, unit: ByteUnit): number =>
	Math.floor(value * B_VALS[unit]);

export const formatFileSize = (bytes: number): string => {
	if (!bytes) return '0 Bytes';
	const { val, unit } = byteInfo(bytes);
	return `${val} ${unit}`;
}
