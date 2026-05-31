export const Stage_1 = Symbol('Stage_1');
export const Stage_2 = Symbol('Stage_2');
export const Stage_3 = Symbol('Stage_3');

export type UploadStage = typeof Stage_1 | typeof Stage_2 | typeof Stage_3;

const stages = new Set([Stage_1, Stage_2, Stage_3]);
export const isWhichUploadStage = (v: unknown): v is UploadStage =>
	typeof v === 'symbol' && stages.has(v);
