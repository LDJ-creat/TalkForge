import type { ProviderMetadata } from "../types";

export const REALTIME_CONNECTION_MODES = ["webrtc", "websocket"] as const;
export type RealtimeConnectionMode = (typeof REALTIME_CONNECTION_MODES)[number];

export type CreateRealtimeSessionInput = {
  userId: string;
  sessionId: string;
  scenarioId: string;
  systemInstructions: string;
  expiresInSec?: number;
  metadata?: Record<string, string>;
};

export type RealtimeSessionCredentials = {
  provider: string;
  providerSessionId: string;
  token: string;
  expiresAt: string;
  connectionMode: RealtimeConnectionMode;
  endpointUrl?: string;
  metadata?: ProviderMetadata;
};

export type RevokeRealtimeSessionInput = {
  providerSessionId: string;
};
