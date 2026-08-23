const T_VALS = {
	Seconds: 1,
	Minutes: 60,
	Hours: 60 * 60,
	Days: 24 * 60 * 60,
	Weeks: 7 * 24 * 60 * 60,
	Months: 30 * 24 * 60 * 60
} as const;
export type TimeUnit = keyof typeof T_VALS;
export const T_UNITS = Object.keys(T_VALS) as TimeUnit[];

export function formatSeconds(seconds: number): { val: number; unit: TimeUnit } {
	if (!seconds) return { val: 0, unit: 'Seconds' };
	for (const unit of T_UNITS.toReversed()) {
		if (seconds >= T_VALS[unit]) {
			return { val: Number((seconds / T_VALS[unit]).toFixed(2)), unit };
		}
	}
	return { val: seconds, unit: 'Seconds' };
}

export function secondsToNumber(value: number, unit: TimeUnit): number {
	return value * T_VALS[unit];
}
