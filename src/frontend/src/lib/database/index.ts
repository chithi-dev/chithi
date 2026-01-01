import { writable } from 'svelte/store';

const DB_NAME = 'chithi_db';
const STORE_NAME = 'uploads';
const DB_VERSION = 1;

export interface UploadEntry {
	id: string;
	name: string;
	link: string;
	expiry: number;
	downloadLimit: string;
	createdAt: number;
	size: string;
}

export const recentUploads = writable<UploadEntry[]>([]);

const openDB = (): Promise<IDBDatabase> => {
	if (typeof indexedDB === 'undefined') {
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

export const getHistory = async (): Promise<UploadEntry[]> => {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();

		return new Promise((resolve, reject) => {
			request.onsuccess = () => {
				const entries = request.result as UploadEntry[];
				const now = Date.now();
				// Return only non-expired entries
				resolve(
					entries
						.filter((e) => e.expiry > now)
						.map((e) => {
							if (e.link.includes('#')) {
								e.link = e.link.replace('#', '?secret=');
							}
							return e;
						})
						.sort((a, b) => b.createdAt - a.createdAt)
				);
			};
			request.onerror = () => reject(request.error);
		});
	} catch (err) {
		console.error('Failed to load history', err);
		return [];
	}
};

const refreshStore = async () => {
	const entries = await getHistory();
	recentUploads.set(entries);
};

export const addHistoryEntry = async (entry: UploadEntry) => {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.add(entry);
		await new Promise((resolve) => (tx.oncomplete = resolve));
		await refreshStore();
	} catch (err) {
		console.error('Failed to add history entry', err);
		throw err;
	}
};

export const deleteHistoryEntry = async (id: string) => {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.delete(id);
		await new Promise((resolve) => (tx.oncomplete = resolve));
		await refreshStore();
	} catch (err) {
		console.error('Failed to delete history entry', err);
		throw err;
	}
};

export const cleanupExpiredEntries = async () => {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.getAll();

		await new Promise<void>((resolve, reject) => {
			request.onsuccess = () => {
				const entries = request.result as UploadEntry[];
				const now = Date.now();
				entries.forEach((entry) => {
					if (entry.expiry <= now) {
						store.delete(entry.id);
					}
				});
			};
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		await refreshStore();
	} catch (err) {
		console.error('Failed to cleanup history', err);
	}
};
