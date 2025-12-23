const T_VALS = {
	Seconds: 1,
	Minutes: 60,
	Hours: 3600,
	Days: 86400,
	Weeks: 604800,
	Months: 2592000
} as const;
export type TimeUnit = keyof typeof T_VALS;
export const T_UNITS = Object.keys(T_VALS) as TimeUnit[];
export function formatSeconds(seconds: number): { val: number; unit: TimeUnit } {
	if (!seconds || seconds === 0) return { val: 0, unit: 'Seconds' };
	for (const unit of [...T_UNITS].reverse()) {
		if (seconds >= T_VALS[unit]) {
			return { val: parseFloat((seconds / T_VALS[unit]).toFixed(2)), unit };
		}
	}
	return { val: seconds, unit: 'Seconds' };
}

export function secondsToNumber(value: number, unit: TimeUnit): number {
	return value * T_VALS[unit];
}
