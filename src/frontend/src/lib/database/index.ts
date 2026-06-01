import type { UploadEntry } from './types';
import { syncEntries } from './recent-uploads.svelte';

const DB_NAME = 'chithi_db';
const STORE_NAME = 'uploads';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
	if (indexedDB === undefined) {
		return Promise.reject(new Error('IndexedDB is not supported'));
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
};

const refreshStore = async () => {
	const entries = await getHistory();
	syncEntries(entries);
};

const waitForTransaction = (tx: IDBTransaction) =>
	new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});

export const getHistory = async (): Promise<UploadEntry[]> => {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => {
				const results = request.result as UploadEntry[];
				const now = Date.now();
				for (const e of results) {
					if (e.link.includes('?secret=')) e.link = e.link.replace('?secret=', '#');
				}
				resolve(results.filter((e) => e.expiry > now).sort((a, b) => b.createdAt - a.createdAt));
			};
			request.onerror = () => reject(request.error);
		});
	} catch (err) {
		console.error('Failed to load history', err);
		return [];
	}
};

const dbWrite = async <T>(fn: (store: IDBObjectStore) => Promise<T>) => {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	await fn(tx.objectStore(STORE_NAME));
	await waitForTransaction(tx);
	await refreshStore();
};

export const addHistoryEntry = async (entry: UploadEntry) => {
	try {
		await dbWrite(async (store) => store.add(entry));
	} catch (err) {
		console.error('Failed to add history entry', err);
		throw err;
	}
};

export const deleteHistoryEntry = async (id: string) => {
	try {
		await dbWrite(async (store) => store.delete(id));
	} catch (err) {
		console.error('Failed to delete history entry', err);
		throw err;
	}
};

export const cleanupExpiredEntries = async () => {
	try {
		await dbWrite(async (store) => {
			const results = (await new Promise<UploadEntry[]>((resolve, reject) => {
				const req = store.getAll();
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			})) as UploadEntry[];
			const now = Date.now();
			for (const entry of results) {
				if (entry.expiry <= now) store.delete(entry.id);
			}
		});
	} catch (err) {
		console.error('Failed to cleanup history', err);
	}
};

export const updateHistoryEntry = async (id: string, updates: Partial<UploadEntry>) => {
	try {
		await dbWrite(async (store) => {
			const entry = (await new Promise<UploadEntry>((resolve, reject) => {
				const req = store.get(id);
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			})) as UploadEntry;
			if (entry) store.put({ ...entry, ...updates });
		});
	} catch (err) {
		console.error('Failed to update history entry', err);
		throw err;
	}
};
