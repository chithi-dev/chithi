import type { UploadEntry } from './types';
import { syncEntries } from './recent-uploads.svelte';

const DB = 'chithi_db', STORE = 'uploads', VER = 1;

const openDB = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB, VER);
  req.onerror = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
  req.onupgradeneeded = (e) => { const db = (e.target as IDBOpenDBRequest).result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
});

const waitTx = (tx: IDBTransaction) => new Promise<void>((r, j) => { tx.oncomplete = r; tx.onerror = () => j(tx.error); });

const refresh = async () => { const entries = await getHistory(); syncEntries(entries); };

const write = async <T>(fn: (store: IDBObjectStore) => Promise<T>) => {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  await fn(tx.objectStore(STORE));
  await waitTx(tx);
  await refresh();
};

const now = () => Temporal.Now.instant().epochMilliseconds;

export const getHistory = async (): Promise<UploadEntry[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const t = now();
        for (const e of req.result as UploadEntry[]) if (e.link.includes('?secret=')) e.link = e.link.replace('?secret=', '#');
        resolve(req.result.filter((e: UploadEntry) => e.expiry > t).sort((a: UploadEntry, b: UploadEntry) => b.createdAt - a.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
};

const withError = async <T>(name: string, fn: () => Promise<T>): Promise<T | void> => {
  try { return await fn(); } catch (err) { console.error(`Failed to ${name}`, err); if (name !== 'cleanup history') throw err; }
};

export const addHistoryEntry = (entry: UploadEntry) => withError('add history entry', () => write((s) => s.add(entry)));
export const deleteHistoryEntry = (id: string) => withError('delete history entry', () => write((s) => s.delete(id)));
export const updateHistoryEntry = (id: string, updates: Partial<UploadEntry>) => withError('update history entry', () => write(async (s) => {
  const entry = await new Promise<UploadEntry>((r, j) => { const req = s.get(id); req.onsuccess = () => r(req.result); req.onerror = () => j(req.error); });
  if (entry) s.put({ ...entry, ...updates });
}));
export const cleanupExpiredEntries = () => withError('cleanup history', () => write(async (s) => {
  const entries = await new Promise<UploadEntry[]>((r, j) => { const req = s.getAll(); req.onsuccess = () => r(req.result); req.onerror = () => j(req.error); });
  const t = now();
  for (const e of entries) if (e.expiry <= t) s.delete(e.id);
}));
