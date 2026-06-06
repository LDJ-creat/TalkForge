import type { SessionStatus } from "./enums";

export type Session = {
  id: string;
  userId: string;
  scenarioId: string;
  realtimeProvider: string;
  realtimeProviderSessionId?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
};

export type CreateSessionInput = {
  userId: string;
  scenarioId: string;
  realtimeProvider: string;
  realtimeProviderSessionId?: string;
};
