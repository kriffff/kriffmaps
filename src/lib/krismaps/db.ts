const DB_NAME = "krismaps";
const DB_VERSION = 3;

export const STORE_SETTINGS = "settings";
export const STORE_FOG = "fog";
export const STORE_THUMBS = "thumbs";
export const STORE_STATE = "state";
/** stat block images, one record per monster, keyed by lower-cased name */
export const STORE_STATBLOCKS = "statblocks";

/** every object store in the database, in a stable order */
export const ALL_STORES = [
  STORE_SETTINGS,
  STORE_FOG,
  STORE_THUMBS,
  STORE_STATE,
  STORE_STATBLOCKS,
] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
      // v3: stat block images moved from one big state record ("monsterPortraits")
      // to one record per monster.
      if (event.oldVersion > 0 && event.oldVersion < 3) {
        const upgrade = req.transaction!;
        const state = upgrade.objectStore(STORE_STATE);
        const read = state.get("monsterPortraits");
        read.onsuccess = () => {
          const old = read.result as Record<string, Blob> | undefined;
          if (old && typeof old === "object") {
            const blocks = upgrade.objectStore(STORE_STATBLOCKS);
            for (const [name, blob] of Object.entries(old)) blocks.put(blob, name);
          }
          state.delete("monsterPortraits");
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbGet<T>(store: string, key: string) {
  return tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function idbSet(store: string, key: string, value: unknown) {
  return tx(store, "readwrite", (s) => s.put(value as never, key));
}

export function idbDelete(store: string, key: string) {
  return tx(store, "readwrite", (s) => s.delete(key));
}

export async function idbEntries<T>(store: string): Promise<Array<[string, T]>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: Array<[string, T]> = [];
    const t = db.transaction(store, "readonly");
    const req = t.objectStore(store).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      out.push([String(cursor.key), cursor.value as T]);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** atomically replaces the contents of the given stores with the supplied records */
export async function idbReplaceAll(data: Record<string, Array<[string, unknown]>>) {
  const db = await openDb();
  const stores = Object.keys(data);
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(stores, "readwrite");
    for (const store of stores) {
      const s = t.objectStore(store);
      s.clear();
      for (const [key, value] of data[store] ?? []) s.put(value as never, key);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function idbKeys(store: string): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result.map(String));
    req.onerror = () => reject(req.error);
  });
}

/** deletes the given keys from several stores in one transaction */
export async function idbDeleteMany(keysByStore: Record<string, string[]>) {
  const db = await openDb();
  const stores = Object.keys(keysByStore).filter((s) => (keysByStore[s] ?? []).length > 0);
  if (stores.length === 0) return;
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(stores, "readwrite");
    for (const store of stores) {
      const s = t.objectStore(store);
      for (const key of keysByStore[store] ?? []) s.delete(key);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
