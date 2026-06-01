import type { UploadEntry } from './types';

let entries = $state<UploadEntry[]>([]);

export let recentUploads = $state({
	get entries(): UploadEntry[] {
		return entries;
	},
	syncEntries(list: UploadEntry[]) {
		entries = list;
	},
	clear() {
		entries = [];
	}
});

export const syncEntries = (list: UploadEntry[]) => {
	entries = list;
};
