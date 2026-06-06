import type { Scenario } from "@/domain/scenario";
import type { SessionStatus } from "@/domain/enums";

import type { ConversationRealtimeCredentials } from "./credentials";

export const CONNECTION_STATUSES = [
  "idle",
  "connecting",
  "connected",
  "disconnecting",
  "disconnected",
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
};

export type ConversationViewState = {
  selectedScenario: Scenario | null;
  session: ConversationSession | null;
  realtimeCredentials: ConversationRealtimeCredentials | null;
  sessionEpoch: number;
  connectionStatus: ConnectionStatus;
  turnStatus: TurnStatus;
  transcripts: TranscriptEntry[];
  endingState: EndingState;
  errorMessage: string | null;
};
