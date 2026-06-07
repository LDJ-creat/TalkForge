import type { ConversationRealtimeCredentials } from "../credentials";
import type { TranscriptEntry } from "../types";

import type {
  RealtimeClient,
  RealtimeClientConnectOptions,
  RealtimeClientEvent,
} from "./client-types";

const MOCK_CONNECT_DELAY_MS = 400;
const MOCK_OPENING_SPEAK_MS = 600;
const MOCK_LISTENING_AFTER_OPEN_MS = 200;

export type MockRealtimeClientOptions = {
  failOnConnect?: boolean;
  failOnDisconnect?: boolean;
  disconnectAfterConnect?: boolean;
};

let mockClientOptions: MockRealtimeClientOptions = {};

export function setMockRealtimeClientOptions(options: MockRealtimeClientOptions): void {
  mockClientOptions = options;
}

export function resetMockRealtimeClientOptions(): void {
  mockClientOptions = {};
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMockRealtimeClient(): RealtimeClient {
  let connected = false;
  let disconnectPromise: Promise<void> | null = null;
  const listeners = new Set<(event: RealtimeClientEvent) => void>();
  let connectStartedAt = 0;

  const emit = (event: RealtimeClientEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  return {
    onEvent(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },

    async connect(_credentials: ConversationRealtimeCredentials, options?: RealtimeClientConnectOptions) {
      if (connected) {
        return;
      }

      connectStartedAt = Date.now();

      await delay(MOCK_CONNECT_DELAY_MS, options?.signal);

      if (mockClientOptions.failOnConnect) {
        throw new Error("Mock realtime connection failed.");
      }

      connected = true;
      const connectLatencyMs = Date.now() - connectStartedAt;
      emit({ type: "diagnostics", diagnostics: { connectLatencyMs } });
      emit({ type: "lifecycle", status: "connected" });

      const opening = options?.openingTranscript;
      if (opening) {
        emit({ type: "lifecycle", status: "assistant_speaking" });
        emit({ type: "transcript", entry: opening });
        await delay(MOCK_OPENING_SPEAK_MS, options?.signal);
        emit({ type: "lifecycle", status: "connected" });
        await delay(MOCK_LISTENING_AFTER_OPEN_MS, options?.signal);
        emit({ type: "lifecycle", status: "listening" });
      } else {
        emit({ type: "lifecycle", status: "listening" });
      }

      if (mockClientOptions.disconnectAfterConnect) {
        connected = false;
        emit({
          type: "error",
          message: "Mock realtime connection closed unexpectedly.",
          recoverable: true,
        });
      }
    },

    async disconnect() {
      if (mockClientOptions.failOnDisconnect) {
        throw new Error("Mock realtime session stop failed.");
      }

      if (!connected && !disconnectPromise) {
        emit({ type: "lifecycle", status: "ended" });
        return;
      }

      connected = false;
      emit({ type: "lifecycle", status: "ended" });
    },

    interrupt() {
      if (!connected) {
        return;
      }

      emit({ type: "lifecycle", status: "interrupted" });
      emit({ type: "lifecycle", status: "listening" });
    },
  };
}

export function createOpeningTranscriptEntry(
  createEntry: (role: TranscriptEntry["role"], text: string) => TranscriptEntry,
  greeting: string,
): TranscriptEntry {
  return createEntry("assistant", greeting);
}
