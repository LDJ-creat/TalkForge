import type { Report } from "@/domain/report";
import type { ShadowingItem } from "@/domain/shadowing";
import type { Scenario } from "@/domain/scenario";
import type { SessionStatus } from "@/domain/enums";

import type { EndingSuggestionReason } from "@/domain/scenario-ending";

import type { ConversationRealtimeCredentials } from "./credentials";
import type { LocalScenarioProgressSnapshot } from "./evaluate-local-progress";
import type {
  RealtimeConnectionDiagnostics,
  RealtimeLifecycleStatus,
} from "./realtime/lifecycle";

export const CONNECTION_STATUSES = [
  "idle",
  "connecting",
  "connected",
  "reconnecting",
  "disconnecting",
  "disconnected",
  "failed",
  "fallback",
  "error",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const TURN_STATUSES = [
  "idle",
  "user_speaking",
  "user_processing",
  "assistant_speaking",
  "assistant_processing",
] as const;
export type TurnStatus = (typeof TURN_STATUSES)[number];

export const ENDING_STATES = [
  "none",
  "user_requested",
  "ai_suggested",
  "completed",
] as const;
export type EndingState = (typeof ENDING_STATES)[number];

export const PROGRESS_SOURCES = ["unknown", "local", "server"] as const;
export type ProgressSource = (typeof PROGRESS_SOURCES)[number];

export const SCENARIO_PROGRESS_REFRESH_INTERVAL_MS = 30_000;

export const TRANSCRIPT_STATUSES = ["pending", "partial", "final"] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: TranscriptStatus;
  timestamp: string;
};

export type ConversationSession = {
  id: string;
  scenarioId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  realtimeProvider?: string;
  backendLinked?: boolean;
};

export type ConversationViewState = {
  selectedScenario: Scenario | null;
  session: ConversationSession | null;
  realtimeCredentials: ConversationRealtimeCredentials | null;
  sessionEpoch: number;
  realtimeLifecycleStatus: RealtimeLifecycleStatus;
  realtimeDiagnostics: RealtimeConnectionDiagnostics;
  connectionStatus: ConnectionStatus;
  turnStatus: TurnStatus;
  transcripts: TranscriptEntry[];
  mockTurnCount: number;
  scenarioProgress: LocalScenarioProgressSnapshot | null;
  progressSource: ProgressSource;
  endingState: EndingState;
  endingSuggestionReason: EndingSuggestionReason | null;
  errorMessage: string | null;
  report: Report | null;
  reportStatus: "idle" | "loading" | "ready" | "unavailable";
  shadowingItems: ShadowingItem[];
  shadowingStatus: "idle" | "loading" | "ready" | "unavailable";
};
