export const B_VALS = {
	Bytes: 1,
	KB: 1024,
	MB: 1024 ** 2,
	GB: 1024 ** 3,
	TB: 1024 ** 4
} as const;
export type ByteUnit = keyof typeof B_VALS;
export function formatBytes(bytes: number): { val: number; unit: ByteUnit } {
	if (!bytes || bytes === 0) return { val: 0, unit: 'MB' };
	const units: ByteUnit[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return {
		val: parseFloat((bytes / Math.pow(1024, i)).toFixed(2)),
		unit: units[i]
	};
}

export function bytesToNumber(value: number, unit: ByteUnit): number {
	return Math.floor(value * B_VALS[unit]);
}
