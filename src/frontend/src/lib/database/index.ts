import { setEntries } from './recent-uploads.svelte';

const DB_NAME = 'chithi_db';
const STORE_NAME = 'uploads';

export interface UploadEntry {
  id: string;
  name: string;
  link: string;
  expiry: number;
  download_limit: string;
  download_count?: number;
  created_at: number;
  size: string;
}

function openDB() {
  if (!indexedDB) return Promise.reject(new Error('IndexedDB is not supported'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
}

function normalizeEntry(entry: UploadEntry) {
  const link = entry.link.includes('?secret=') ? entry.link.replace('?secret=', '#') : entry.link;
  return { ...entry, link };
}

async function txComplete(tx: IDBTransaction) {
  return new Promise<void>(resolve => tx.oncomplete = () => resolve());
}

const refreshStore = async () => setEntries(await getHistory());

export const getHistory = async (): Promise<UploadEntry[]> => {
  try {
    const db = await openDB() as IDBDatabase;
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(
        (request.result as UploadEntry[])
          .filter(e => e.expiry > Date.now())
          .map(normalizeEntry)
          .toSorted((a, b) => b.created_at - a.created_at)
      );
      request.onerror = () => reject(request.error);
    });
  } catch { console.error('Failed to load history'); return []; }
};

export const addHistoryEntry = async (entry: UploadEntry) => {
  try {
    const db = await openDB() as IDBDatabase;
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).add(entry);
    await txComplete(db.transaction(STORE_NAME, 'readonly'));
    await refreshStore();
  } catch (err) { console.error('Failed to add history entry', err); throw err; }
};

export const deleteHistoryEntry = async (id: string) => {
  try {
    const db = await openDB() as IDBDatabase;
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    await txComplete(db.transaction(STORE_NAME, 'readonly'));
    await refreshStore();
  } catch (err) { console.error('Failed to delete history entry', err); throw err; }
};

export const cleanupExpiredEntries = async () => {
  try {
    const db = await openDB() as IDBDatabase;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const now = Date.now();
        for (const entry of request.result as UploadEntry[]) if (entry.expiry <= now) store.delete(entry.id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await refreshStore();
  } catch { console.error('Failed to cleanup history'); }
};

export const updateHistoryEntry = async ({ id, updates }: { id: string; updates: Partial<UploadEntry> }) => {
  try {
    const db = await openDB() as IDBDatabase;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => { const entry = request.result as UploadEntry; if (entry) store.put({ ...entry, ...updates }); resolve(); };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
    });
    await refreshStore();
  } catch (err) { console.error('Failed to update history entry', err); throw err; }
};
