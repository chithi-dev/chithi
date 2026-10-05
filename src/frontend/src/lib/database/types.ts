export interface UploadEntry {
	id: string;
	name: string;
	link: string;
	expiry: number;
	downloadLimit: string;
	downloadCount?: number;
	createdAt: number;
	size: string;
}
