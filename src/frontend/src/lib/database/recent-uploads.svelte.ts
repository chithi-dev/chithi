import type { UploadEntry } from './index';

let entries = $state<UploadEntry[]>([]);

export const setEntries = (list: UploadEntry[]) => entries = list;

export const recentUploads = {
	get entries() {
		return entries;
	},
	setEntries,
	clear() {
		entries = [];
	}
};
