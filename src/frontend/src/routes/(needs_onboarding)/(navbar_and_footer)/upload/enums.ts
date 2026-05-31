export enum UploadStage {
	Stage_1,
	Stage_2,
	Stage_3
}

const uploadStages = new Set<UploadStage>(
	Object.values(UploadStage).filter((value): value is UploadStage => typeof value === 'number')
);

export const isWhichUploadStage = (value: unknown): value is UploadStage => {
	return typeof value === 'number' && uploadStages.has(value);
};
