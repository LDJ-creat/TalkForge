import { describe, expect, it } from "vitest";

import {
  createIndexedDbTurnAudioCacheAdapter,
  TURN_AUDIO_CACHE_STORE_NAME,
} from "@/lib/audio-cache/indexed-db";

function createRequest<T>(result: T): IDBRequest<T> {
  const request = {
    result,
    onsuccess: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
  } as IDBRequest<T>;

  queueMicrotask(() => {
    request.onsuccess?.({} as Event);
  });

  return request;
}

function createFakeIndexedDb() {
  const store = new Map<string, unknown>();

  const objectStore = {
    put(value: unknown) {
      const key = (value as { turnId: string }).turnId;
      store.set(key, value);
      return createRequest(undefined);
    },
    get(key: string) {
      return createRequest(store.get(key));
    },
    delete(key: string) {
      store.delete(key);
      return createRequest(undefined);
    },
    getAll() {
      return createRequest([...store.values()]);
    },
  };

  return {
    open(name: string) {
      void name;
      const request = {
        result: undefined as IDBDatabase | undefined,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
      } as IDBOpenDBRequest;

      const db = {
        objectStoreNames: {
          contains(storeName: string) {
            return storeName === TURN_AUDIO_CACHE_STORE_NAME;
          },
        },
        createObjectStore(storeName: string) {
          void storeName;
          return objectStore as unknown as IDBObjectStore;
        },
        transaction(storeName: string, mode: IDBTransactionMode) {
          void storeName;
          void mode;
          const transaction = {
            oncomplete: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
            onabort: null as ((event: Event) => void) | null,
            objectStore() {
              return objectStore as unknown as IDBObjectStore;
            },
          } as unknown as IDBTransaction;

          queueMicrotask(() => {
            transaction.oncomplete?.({} as Event);
          });

          return transaction;
        },
      } as unknown as IDBDatabase;

      queueMicrotask(() => {
        (request as { result?: IDBDatabase }).result = db;
        request.onupgradeneeded?.({} as IDBVersionChangeEvent);
        request.onsuccess?.({} as Event);
      });

      return request;
    },
  } as IDBFactory;
}

describe("IndexedDbTurnAudioCacheAdapter", () => {
  it("persists turn audio entries through a test IndexedDB adapter", async () => {
    const adapter = createIndexedDbTurnAudioCacheAdapter({
      indexedDB: createFakeIndexedDb(),
    });

    await adapter.save({
      turnId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      blob: new Blob(["audio"], { type: "audio/webm" }),
      durationMs: 1_200,
    });

    const entry = await adapter.get("22222222-2222-4222-8222-222222222222");
    expect(entry?.uploadStatus).toBe("pending");
  });
});


