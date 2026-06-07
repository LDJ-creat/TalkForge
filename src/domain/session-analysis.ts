import type { Correction } from "./correction";
import type { Report } from "./report";
import type { Session } from "./session";
import type { ShadowingItem } from "./shadowing";
import type { TurnPronunciationFeedback } from "./pronunciation-feedback";
import type { Turn } from "./turn";

export type SessionAnalysisTurn = {
  id: string;
  sessionId: string;
  role: Turn["role"];
  startedAt: string;
  endedAt: string;
  transcriptText?: string;
  evaluationStatus: Turn["evaluationStatus"];
  pronunciationFeedback?: TurnPronunciationFeedback;
  corrections: Correction[];
};

export type SessionAnalysis = {
  session: Pick<Session, "id" | "scenarioId" | "status" | "startedAt" | "endedAt">;
  report: Report;
  turns: SessionAnalysisTurn[];
  shadowingItems: ShadowingItem[];
};
