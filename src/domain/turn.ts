import type { EvaluationStatus, TurnRole } from "./enums";

export type Turn = {
  id: string;
  sessionId: string;
  role: TurnRole;
  startedAt: string;
  endedAt: string;
  transcriptText?: string;
  audioSegmentId?: string;
  evaluationStatus: EvaluationStatus;
};

export type CreateTurnInput = {
  sessionId: string;
  role: TurnRole;
  startedAt: string;
  endedAt: string;
  transcriptText?: string;
  audioSegmentId?: string;
  evaluationStatus?: EvaluationStatus;
};
