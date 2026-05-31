export const B_VALS = {
	Bytes: 1,
	KB: 1024,
	MB: 1024 ** 2,
	GB: 1024 ** 3,
	TB: 1024 ** 4
} as const;

export type ByteUnit = keyof typeof B_VALS;
export const BYTE_UNITS = Object.keys(B_VALS) as ByteUnit[];

export const calcBytes = (bytes: number) => {
	if (!bytes) return { val: 0, unit: (bytes === 0 ? 'MB' : 'Bytes') as ByteUnit };
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return { val: Number((bytes / 1024 ** i).toFixed(2)), unit: BYTE_UNITS[i] };
};

export const formatFileSize = (bytes: number) => {
	const { val, unit } = calcBytes(bytes);
	return `${val} ${unit}`;
};

export const bytesToNumber = (value: number, unit: ByteUnit) => Math.floor(value * B_VALS[unit]);
