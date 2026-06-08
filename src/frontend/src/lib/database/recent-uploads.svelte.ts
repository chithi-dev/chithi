import type { UploadEntry } from './types';

let list = $state<UploadEntry[]>([]);

export const recentUploads = {
  get entries(): UploadEntry[] { return list; },
  clear() { list = []; },
};

export const syncEntries = (entries: UploadEntry[]) => { list = entries; };
