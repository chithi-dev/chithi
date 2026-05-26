export type OgConfig = {
	label: string;
	title?: string;
	description?: string;
	footerTags?: string[];
	labelFromQuery?: boolean;
	usesFileMeta?: boolean;
};

export type OgInputs = {
	label?: string | null;
	title?: string | null;
	description?: string | null;
	filename?: string | null;
	size?: string | null;
	fileCount?: number | null;
};

export type OgDisplay = {
	label: string;
	title: string;
	subtitle: string;
	footerTags?: string[];
};
