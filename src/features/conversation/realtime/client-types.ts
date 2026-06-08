import type { ConversationRealtimeCredentials } from "../credentials";
import type { TranscriptEntry } from "../types";
import type { RealtimeConnectionDiagnostics, RealtimeLifecycleStatus } from "./lifecycle";

export type RealtimeClientEvent =
  | { type: "lifecycle"; status: RealtimeLifecycleStatus }
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "transcript_delta"; entryId: string; text: string; role: TranscriptEntry["role"] }
  | { type: "diagnostics"; diagnostics: Partial<RealtimeConnectionDiagnostics> }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "session_ready" }
  | { type: "provider_audio_delta"; base64Pcm: string }
  | { type: "provider_audio_done" }
  | { type: "user_speech_started" }
  | { type: "user_speech_stopped" }
  | {
      type: "session_end_requested";
      reason: "goals_complete" | "user_requested" | "natural_closing";
    };

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
