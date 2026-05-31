export const Stage_1 = Symbol('Stage_1');
export const Stage_2 = Symbol('Stage_2');

export type OnboardingStep = typeof Stage_1 | typeof Stage_2;

const stages = new Set([Stage_1, Stage_2]);
export const isWhichOnboardingStep = (v: unknown): v is OnboardingStep =>
	typeof v === 'symbol' && stages.has(v);
