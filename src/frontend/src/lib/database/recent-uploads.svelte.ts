import type { UploadEntry } from './types';

let entries = $state<UploadEntry[]>([]);

export let recentUploads = $state({
	get entries(): UploadEntry[] {
		return entries;
	},
	clear() {
		entries = [];
	}
});

export const syncEntries = (list: UploadEntry[]) => {
	entries = list;
};
