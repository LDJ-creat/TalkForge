import { mapQwenOmniServerEvent } from "./adapters/qwen-omni-events";
import { isQwenOmniRealtimeProvider } from "./adapters/qwen-omni-connect";
import type {
  RealtimeClient,
  RealtimeClientConnectOptions,
  RealtimeClientEvent,
} from "./client-types";
import type { ConversationRealtimeCredentials } from "../credentials";
import { resolveBrowserWebSocketConnection } from "./resolve-browser-websocket";
import type { RealtimeLifecycleStatus } from "./lifecycle";

export type WebSocketFactory = (
  url: string,
  protocols?: string | string[],
) => WebSocket;

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

function parseServerPayload(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

export function createWebsocketRealtimeClient(
  webSocketFactory: WebSocketFactory = (url, protocols) => new WebSocket(url, protocols),
): RealtimeClient {
  let socket: WebSocket | null = null;
  let connected = false;
  const listeners = new Set<(event: RealtimeClientEvent) => void>();
  let parserState: {
    lifecycle: RealtimeLifecycleStatus;
    activeResponseId?: string;
  } = { lifecycle: "idle" };
  let credentialsProvider = "";

  const emit = (event: RealtimeClientEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const mapProviderEvent = (payload: unknown): void => {
    if (isQwenOmniRealtimeProvider(credentialsProvider)) {
      const mapped = mapQwenOmniServerEvent(payload, parserState);
      parserState = mapped.nextState;
      for (const event of mapped.events) {
        emit(event);
      }
      return;
    }

    const event = payload as { type?: string };
    if (event.type === "error") {
      emit({
        type: "error",
        message: "Realtime connection reported an error.",
        recoverable: true,
      });
    }
  };

  return {
    onEvent(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },

    sendProviderMessage(message: unknown) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(JSON.stringify(message));
    },

    async connect(credentials: ConversationRealtimeCredentials, options?: RealtimeClientConnectOptions) {
      if (connected) {
        return;
      }

      credentialsProvider = credentials.provider;
      parserState = { lifecycle: "connecting" };

      const startedAt = Date.now();
      const connection = resolveBrowserWebSocketConnection(credentials);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = globalThis.setTimeout(() => {
          if (!settled) {
            settled = true;
            socket?.close();
            reject(new Error("Realtime connection timed out."));
          }
        }, DEFAULT_CONNECT_TIMEOUT_MS);

        const abortHandler = () => {
          if (!settled) {
            settled = true;
            globalThis.clearTimeout(timeoutId);
            socket?.close();
            reject(new DOMException("Aborted", "AbortError"));
          }
        };

        options?.signal?.addEventListener("abort", abortHandler, { once: true });

        try {
          socket = webSocketFactory(connection.url, connection.protocols);
        } catch (error) {
          globalThis.clearTimeout(timeoutId);
          reject(error);
          return;
        }

        socket.addEventListener("open", () => {
          if (settled) {
            return;
          }

          settled = true;
          globalThis.clearTimeout(timeoutId);
          options?.signal?.removeEventListener("abort", abortHandler);

          connected = true;
          emit({
            type: "diagnostics",
            diagnostics: {
              connectLatencyMs: Date.now() - startedAt,
              provider: credentials.provider,
            },
          });

          const sessionUpdateEvent =
            options?.sessionUpdateEvent ??
            credentials.metadata?.sessionUpdateEvent;

          if (sessionUpdateEvent) {
            socket?.send(JSON.stringify(sessionUpdateEvent));
          }

          if (options?.openingTranscript) {
            emit({ type: "transcript", entry: options.openingTranscript });
          }

          emit({ type: "lifecycle", status: "connected" });
          emit({ type: "lifecycle", status: "listening" });
          resolve();
        });

        socket.addEventListener("message", (messageEvent) => {
          const payload =
            typeof messageEvent.data === "string"
              ? parseServerPayload(messageEvent.data)
              : null;

          if (payload) {
            emit({
              type: "diagnostics",
              diagnostics: {
                lastEventLatencyMs: Date.now() - startedAt,
              },
            });
            mapProviderEvent(payload);
          }
        });

        socket.addEventListener("error", () => {
          if (!settled) {
            settled = true;
            globalThis.clearTimeout(timeoutId);
            console.warn(
              "[talkforge:realtime] websocket error before ready",
              JSON.stringify({
                provider: credentials.provider,
                url: connection.url,
              }),
            );
            reject(new Error("Realtime WebSocket connection failed."));
            return;
          }

          emit({
            type: "error",
            message: "Realtime connection encountered an error.",
            recoverable: true,
          });
        });

        socket.addEventListener("close", (closeEvent) => {
          connected = false;
          if (!settled) {
            settled = true;
            globalThis.clearTimeout(timeoutId);
            console.warn(
              "[talkforge:realtime] websocket closed before ready",
              JSON.stringify({
                provider: credentials.provider,
                url: connection.url,
                code: closeEvent.code,
                reason: closeEvent.reason,
                wasClean: closeEvent.wasClean,
              }),
            );
            reject(
              new Error(
                closeEvent.reason
                  ? `Realtime connection closed before ready (${closeEvent.code}: ${closeEvent.reason}).`
                  : "Realtime connection closed before ready.",
              ),
            );
            return;
          }

          console.warn(
            "[talkforge:realtime] websocket closed after connect",
            JSON.stringify({
              provider: credentials.provider,
              code: closeEvent.code,
              reason: closeEvent.reason,
            }),
          );
          emit({
            type: "error",
            message: "Realtime connection closed unexpectedly.",
            recoverable: true,
          });
        });
      });
    },

    async disconnect() {
      connected = false;
      parserState = { lifecycle: "ended" };

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "session ended");
      }

      socket = null;
      emit({ type: "lifecycle", status: "ended" });
    },

    interrupt() {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(JSON.stringify({ type: "response.cancel" }));
      emit({ type: "lifecycle", status: "interrupted" });
    },
  };
}

export function isMockRealtimeProvider(provider: string): boolean {
  return provider === "mock-realtime";
}
