export enum UploadStage {
	Stage_1,
	Stage_2,
	Stage_3
}

export const isWhichUploadStage = (value: unknown): value is UploadStage => {
	return (
		value === UploadStage.Stage_1 || value === UploadStage.Stage_2 || value === UploadStage.Stage_3
	);
};
