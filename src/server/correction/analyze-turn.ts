import type { Correction, CreateCorrectionInput } from "@/domain/correction";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { Transcript } from "@/domain/transcript";
import type { Turn } from "@/domain/turn";
import type { LlmCorrectionProvider } from "@/providers/llm/contract";
import { normalizeCorrectionAnalysisItems } from "@/providers/llm/correction-policy";
import { isProviderError } from "@/providers/errors";
import { JobProcessingError } from "@/queue/errors";
import type { CorrectionAnalyzePayload } from "@/queue/payloads";

import { buildTranscriptFromTurn } from "@/server/turn-post-audio";

import {
  buildCorrectionAnalyzeInput,
  buildCorrectionPromptFromAnalyzeInput,
  buildRecentContextTurns,
} from "./prompt-builder";

export type CorrectionAnalyzeTurnResult = {
  corrections: Correction[];
  created: boolean;
};

export type CorrectionAnalyzeTurnDeps = {
  llmProvider: LlmCorrectionProvider;
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  getTurnById: (turnId: string) => Promise<Turn | null>;
  listTurnsBySessionId: (sessionId: string) => Promise<Turn[]>;
  getTranscriptById: (transcriptId: string) => Promise<Transcript | null>;
  getTranscriptByTurnId: (turnId: string) => Promise<Transcript | null>;
  getTranscriptsByTurnIds: (turnIds: string[]) => Promise<Map<string, Transcript>>;
  getCorrectionsByTurnId: (turnId: string) => Promise<Correction[]>;
  saveCorrectionsForTurnIfAbsent: (
    turnId: string,
    inputs: CreateCorrectionInput[],
  ) => Promise<{ corrections: Correction[]; created: boolean }>;
};

export async function analyzeTurnCorrections(
  payload: CorrectionAnalyzePayload,
  deps: CorrectionAnalyzeTurnDeps,
  context: { attempts: number },
): Promise<CorrectionAnalyzeTurnResult> {
  const turn = await deps.getTurnById(payload.turnId);
  if (!turn || turn.sessionId !== payload.sessionId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Turn ${payload.turnId} was not found for session ${payload.sessionId}.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  if (turn.role !== "user") {
    throw new JobProcessingError({
      code: "validation",
      message: "Correction analysis applies to learner user turns only.",
      attempts: context.attempts,
      retryable: false,
    });
  }

  const existingCorrections = await deps.getCorrectionsByTurnId(payload.turnId);
  if (existingCorrections.length > 0) {
    return {
      corrections: existingCorrections,
      created: false,
    };
  }

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

  const transcript = await resolveTranscript(payload, turn, deps);
  if (!transcript || transcript.turnId !== payload.turnId) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Realtime transcript for turn ${payload.turnId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  const sessionTurns = await deps.listTurnsBySessionId(payload.sessionId);
  const transcriptsByTurnId = await buildTranscriptLookup(sessionTurns, deps);
  const recentContext = buildRecentContextTurns(
    sessionTurns,
    payload.turnId,
    transcriptsByTurnId,
  );

  const analyzeInput = buildCorrectionAnalyzeInput({
    turnId: payload.turnId,
    transcript,
    recentContext,
    scenarioLevel: scenario.level,
    scenarioConstraints: scenario.constraints,
  });
  const prompt = buildCorrectionPromptFromAnalyzeInput(analyzeInput);

  let analysis;
  try {
    analysis = await deps.llmProvider.analyzeCorrections({
      ...analyzeInput,
      prompt: {
        system: prompt.system,
        user: prompt.user,
      },
    });
  } catch (error) {
    throw mapProviderErrorToJobError(error, {
      provider: deps.llmProvider.name,
      attempts: context.attempts,
    });
  }

  let normalizedItems;
  try {
    normalizedItems = normalizeCorrectionAnalysisItems(analysis.corrections);
  } catch (error) {
    throw new JobProcessingError({
      code: "validation",
      message: error instanceof Error ? error.message : "Invalid correction analysis output.",
      attempts: context.attempts,
      retryable: false,
      metadata: {
        provider: deps.llmProvider.name,
      },
    });
  }

  const saveResult = await deps.saveCorrectionsForTurnIfAbsent(
    payload.turnId,
    normalizedItems.map((item) => ({
      turnId: payload.turnId,
      type: item.type,
      originalText: item.originalText,
      correctedText: item.correctedText,
      explanation: item.explanation,
      confidence: item.confidence,
    })),
  );

  return saveResult;
}

async function resolveTranscript(
  payload: CorrectionAnalyzePayload,
  turn: Turn,
  deps: CorrectionAnalyzeTurnDeps,
): Promise<Transcript | null> {
  const fromTurn = buildTranscriptFromTurn(turn);
  if (fromTurn) {
    return fromTurn;
  }

  if (payload.transcriptId) {
    const byId = await deps.getTranscriptById(payload.transcriptId);
    if (byId) {
      return byId;
    }
  }

  return deps.getTranscriptByTurnId(payload.turnId);
}

async function buildTranscriptLookup(
  sessionTurns: Turn[],
  deps: CorrectionAnalyzeTurnDeps,
): Promise<Map<string, Transcript | null>> {
  const turnIds = sessionTurns.map((turn) => turn.id);
  const transcriptsByTurnId = await deps.getTranscriptsByTurnIds(turnIds);

  return new Map(
    sessionTurns.map((turn) => {
      const persisted = transcriptsByTurnId.get(turn.id) ?? null;
      return [turn.id, buildTranscriptFromTurn(turn) ?? persisted] as const;
    }),
  );
}

function mapProviderErrorToJobError(
  error: unknown,
  context: { provider: string; attempts: number },
): JobProcessingError {
  if (isProviderError(error)) {
    const code =
      error.code === "not_found"
        ? "not_found"
        : error.code === "invalid_request"
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
    message: error instanceof Error ? error.message : "Correction analysis failed.",
    attempts: context.attempts,
    retryable: true,
    cause: error,
  });
}

