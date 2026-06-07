import type { ConversationRealtimeCredentials } from "../credentials";
import type { TranscriptEntry } from "../types";
import type { RealtimeConnectionDiagnostics, RealtimeLifecycleStatus } from "./lifecycle";

export type RealtimeClientEvent =
  | { type: "lifecycle"; status: RealtimeLifecycleStatus }
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "transcript_delta"; entryId: string; text: string; role: TranscriptEntry["role"] }
  | { type: "diagnostics"; diagnostics: Partial<RealtimeConnectionDiagnostics> }
  | { type: "error"; message: string; recoverable: boolean };

export type RealtimeClientConnectOptions = {
  openingTranscript?: TranscriptEntry;
  sessionUpdateEvent?: unknown;
  signal?: AbortSignal;
};

export interface RealtimeClient {
  connect(
    credentials: ConversationRealtimeCredentials,
    options?: RealtimeClientConnectOptions,
  ): Promise<void>;
  disconnect(): Promise<void>;
  interrupt?(): void;
  sendProviderMessage?(message: unknown): void;
  onEvent(handler: (event: RealtimeClientEvent) => void): () => void;
}
