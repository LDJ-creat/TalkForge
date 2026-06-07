import { countUserTurns } from "@/domain/scenario-ending";
import type { Turn } from "@/domain/turn";
import type { QueueAdapter } from "@/queue/adapter";
import {
  enqueueCorrectionAnalyzeJob,
  enqueueEvaluationFreeSpeechJob,
  enqueueScenarioProgressEvaluateJob,
} from "@/queue/enqueue";
import { getRuntimeConfig } from "@/server/config";
import { shouldEnqueueScenarioProgressJudge } from "@/server/scenario-progress/enqueue-policy";

export type TurnPostAudioEnqueueInput = {
  turnId: string;
  sessionId: string;
  audioSegmentId: string;
};

export type TurnPostAudioEnqueueDeps = {
  queueAdapter: QueueAdapter;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  countUserTurnsBySessionId?: (sessionId: string) => Promise<number>;
};

export async function enqueueTurnPostAudioJobs(
  input: TurnPostAudioEnqueueInput,
  deps: TurnPostAudioEnqueueDeps,
): Promise<boolean> {
  const turn = await deps.getTurnById(input.turnId);
  if (!turn || turn.sessionId !== input.sessionId) {
    return false;
  }

  if (!turn.transcriptText?.trim()) {
    return false;
  }

  await enqueueCorrectionAnalyzeJob(deps.queueAdapter, {
    turnId: input.turnId,
    sessionId: input.sessionId,
  });
  await enqueueEvaluationFreeSpeechJob(deps.queueAdapter, {
    turnId: input.turnId,
    sessionId: input.sessionId,
    audioSegmentId: input.audioSegmentId,
  });

  if (turn.role === "user") {
    const shouldEnqueue = await shouldEnqueueScenarioProgressJudgeForTurn(deps, input.sessionId);
    if (shouldEnqueue) {
      await enqueueScenarioProgressEvaluateJob(deps.queueAdapter, {
        sessionId: input.sessionId,
        triggerTurnId: input.turnId,
      });
    }
  }

  return true;
}

async function shouldEnqueueScenarioProgressJudgeForTurn(
  deps: TurnPostAudioEnqueueDeps,
  sessionId: string,
): Promise<boolean> {
  const interval = getRuntimeConfig().scenarioProgress.judgeUserTurnInterval;
  if (interval <= 1) {
    return true;
  }

  if (!deps.countUserTurnsBySessionId) {
    return true;
  }

  const userTurnCount = await deps.countUserTurnsBySessionId(sessionId);
  return shouldEnqueueScenarioProgressJudge(userTurnCount, interval);
}

export function createCountUserTurnsBySessionId(
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>,
): (sessionId: string) => Promise<number> {
  return async (sessionId) => {
    const turns = await listTurnsBySessionId(sessionId);
    return countUserTurns(turns);
  };
}
