import type { Scenario } from "@/domain/scenario";
import type { ScenarioProgress } from "@/domain/scenario-progress";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import {
  buildScenarioProgressUpdate,
  createInitialScenarioProgress,
} from "@/domain/scenario-ending";
import type { LlmGoalJudgeProvider } from "@/providers/llm/contract";
import { isProviderError } from "@/providers/errors";
import { JobProcessingError } from "@/queue/errors";
import type { ScenarioProgressEvaluatePayload } from "@/queue/payloads";

export type EvaluateSessionProgressResult = {
  progress: ScenarioProgress;
  created: boolean;
};

export type EvaluateSessionProgressDeps = {
  goalJudgeProvider: LlmGoalJudgeProvider;
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  getTranscriptsByTurnIds: (turnIds: string[]) => Promise<Map<string, Transcript>>;
  getScenarioProgressBySessionId: (
    sessionId: string,
  ) => Promise<ScenarioProgress | null>;
  upsertScenarioProgress: (
    sessionId: string,
    progress: ScenarioProgress,
  ) => Promise<ScenarioProgress>;
};

export async function evaluateSessionProgress(
  payload: ScenarioProgressEvaluatePayload,
  deps: EvaluateSessionProgressDeps,
  context: { attempts: number },
): Promise<EvaluateSessionProgressResult> {
  const session = await deps.getSessionById(payload.sessionId);
  if (!session) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Session ${payload.sessionId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const scenario = await deps.getScenarioById(session.scenarioId);
  if (!scenario) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Scenario ${session.scenarioId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const existingProgress = await deps.getScenarioProgressBySessionId(payload.sessionId);
  const previousProgress =
    existingProgress ?? createInitialScenarioProgress(payload.sessionId, scenario);

  const turns = await deps.listTurnsBySessionId(payload.sessionId);
  const userTurns = turns.filter((turn) => turn.role === "user");
  const transcriptsByTurnId = await deps.getTranscriptsByTurnIds(
    userTurns.map((turn) => turn.id),
  );

  let judgeResult;
  try {
    judgeResult = await deps.goalJudgeProvider.evaluateGoals({
      sessionId: payload.sessionId,
      scenario: {
        id: scenario.id,
        title: scenario.title,
        goals: scenario.goals,
        stages: scenario.stages,
        vocabulary: scenario.vocabulary,
        targetExpressions: scenario.targetExpressions,
        exitPolicy: scenario.exitPolicy,
      },
      turns: turns.map((turn) => ({
        turnId: turn.id,
        role: turn.role,
        text:
          transcriptsByTurnId.get(turn.id)?.text ??
          turn.transcriptText ??
          "",
      })),
      previousProgress,
    });
  } catch (error) {
    throw mapProviderErrorToJobError(error, {
      provider: deps.goalJudgeProvider.name,
      attempts: context.attempts,
    });
  }

  const progressUpdate = buildScenarioProgressUpdate({
    sessionId: payload.sessionId,
    scenario,
    session,
    turns,
    completedGoalIds: judgeResult.completedGoalIds,
    previousCompletedGoalIds: previousProgress.completedGoalIds,
    offTopic: judgeResult.offTopic,
  });

  const persisted = await deps.upsertScenarioProgress(payload.sessionId, {
    sessionId: progressUpdate.sessionId,
    currentStageId: progressUpdate.currentStageId,
    completedGoalIds: progressUpdate.completedGoalIds,
    missingGoalIds: progressUpdate.missingGoalIds,
    shouldSuggestEnding: progressUpdate.shouldSuggestEnding,
    offTopic: progressUpdate.offTopic,
    updatedAt: progressUpdate.updatedAt,
  });

  return {
    progress: persisted,
    created: existingProgress === null,
  };
}

function mapProviderErrorToJobError(
  error: unknown,
  context: { provider: string; attempts: number },
): JobProcessingError {
  if (isProviderError(error)) {
    const code =
      error.code === "not_found"
        ? "not_found"
        : error.code === "invalid_request" || error.code === "configuration"
          ? "validation"
          : error.code === "timeout"
            ? "timeout"
            : "processing";

    return new JobProcessingError({
      code,
      message: error.message,
      attempts: context.attempts,
      retryable: error.retryable,
      cause: error,
      metadata: {
        provider: context.provider,
        providerCode: error.code,
      },
    });
  }

  return new JobProcessingError({
    code: "processing",
    message: error instanceof Error ? error.message : "Scenario progress evaluation failed.",
    attempts: context.attempts,
    retryable: true,
    cause: error,
  });
}
