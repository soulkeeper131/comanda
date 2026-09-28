// IndexedDB хранилище за офлайн опашката — localStorage не може да държи
// снимки (Blob), IndexedDB може. Без IndexedDB (частен режим, SSR) падаме
// към паметта: опашката работи, но не преживява презареждане.

import { createMemoryStore, type KVStore } from "./offline-queue";

const DB_NAME = "komanda-offline";
const STORE = "kv";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function createIdbStore(): KVStore {
  if (typeof indexedDB === "undefined") return createMemoryStore();

  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }).catch((err) => {
        dbPromise = null;
        throw err;
      });
    }
    return dbPromise;
  };

  const fallback = createMemoryStore();
  const tx = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);

  return {
    async get<T>(key: string) {
      try {
        return (await req((await tx("readonly")).get(key))) as T | undefined;
      } catch {
        return fallback.get<T>(key);
      }
    },
    async set(key, value) {
      try {
        await req((await tx("readwrite")).put(value, key));
      } catch {
        await fallback.set(key, value);
      }
    },
    async del(key) {
      try {
        await req((await tx("readwrite")).delete(key));
      } catch {
        await fallback.del(key);
      }
    },
  };
}
