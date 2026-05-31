export enum UploadStage {
	Stage_1,
	Stage_2,
	Stage_3
}
const stages = new Set([0, 1, 2]);
export const isWhichUploadStage = (v: unknown): v is UploadStage =>
	typeof v === 'number' && stages.has(v);
