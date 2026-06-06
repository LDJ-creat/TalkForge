import type { SaveTurnAudioCacheInput, TurnAudioCacheAdapter, TurnAudioCacheEntry } from "./types";

export const TURN_AUDIO_CACHE_DB_NAME = "talkforge-turn-audio-cache";
export const TURN_AUDIO_CACHE_STORE_NAME = "turn-audio";
export const TURN_AUDIO_CACHE_DB_VERSION = 1;

export type IndexedDbTurnAudioCacheAdapterOptions = {
  indexedDB?: IDBFactory;
  dbName?: string;
};

function openDatabase(options: IndexedDbTurnAudioCacheAdapterOptions): Promise<IDBDatabase> {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(
      options.dbName ?? TURN_AUDIO_CACHE_DB_NAME,
      TURN_AUDIO_CACHE_DB_VERSION,
    );

    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TURN_AUDIO_CACHE_STORE_NAME)) {
        db.createObjectStore(TURN_AUDIO_CACHE_STORE_NAME, { keyPath: "turnId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

export function createIndexedDbTurnAudioCacheAdapter(
  options: IndexedDbTurnAudioCacheAdapterOptions = {},
): TurnAudioCacheAdapter {
  let dbPromise: Promise<IDBDatabase> | undefined;

  async function getDb() {
    dbPromise ??= openDatabase(options);
    return dbPromise;
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    const db = await getDb();
    const transaction = db.transaction(TURN_AUDIO_CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(TURN_AUDIO_CACHE_STORE_NAME);
    return callback(store);
  }

  return {
    async save(input: SaveTurnAudioCacheInput) {
      const entry: TurnAudioCacheEntry = {
        turnId: input.turnId,
        sessionId: input.sessionId,
        blob: input.blob,
        uploadStatus: "pending",
        updatedAt: new Date().toISOString(),
      };
      await withStore("readwrite", (store) => runRequest(store.put(entry)));
      return entry;
    },
    async get(turnId) {
      return withStore("readonly", (store) => runRequest(store.get(turnId)));
    },
    async listPending() {
      const entries = await withStore("readonly", (store) => runRequest(store.getAll()));
      return entries.filter((entry) => entry.uploadStatus === "pending");
    },
    async markUploaded(turnId, objectKey) {
      const existing = await this.get(turnId);
      if (!existing) {
        return null;
      }
      const updated: TurnAudioCacheEntry = {
        ...existing,
        uploadStatus: "uploaded",
        objectKey,
        updatedAt: new Date().toISOString(),
      };
      await withStore("readwrite", (store) => runRequest(store.put(updated)));
      return updated;
    },
    async markFailed(turnId, message) {
      const existing = await this.get(turnId);
      if (!existing) {
        return null;
      }
      const updated: TurnAudioCacheEntry = {
        ...existing,
        uploadStatus: "failed",
        lastError: message,
        updatedAt: new Date().toISOString(),
      };
      await withStore("readwrite", (store) => runRequest(store.put(updated)));
      return updated;
    },
    async remove(turnId) {
      await withStore("readwrite", (store) => runRequest(store.delete(turnId)));
    },
  };
}

