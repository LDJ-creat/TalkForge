import type { Report } from "@/domain/report";
import type { Scenario } from "@/domain/scenario";
import type { Session } from "@/domain/session";
import type { ShadowingItem } from "@/domain/shadowing";
import type { Correction } from "@/domain/correction";
import { isProviderError } from "@/providers/errors";
import type { TtsProvider } from "@/providers/tts/contract";
import { JobProcessingError } from "@/queue/errors";
import type { ShadowingGeneratePayload } from "@/queue/payloads";
import type { PrepareShadowingGenerationResult } from "@/server/db/repositories/shadowing-item-repository";

import { attachStandardAudioToShadowingItem } from "./items";
import { selectShadowingItems } from "./select-items";

export type GenerateSessionShadowingResult = {
  items: ShadowingItem[];
  created: boolean;
};

export type GenerateSessionShadowingDeps = {
  ttsProvider: TtsProvider;
  defaultVoice?: string;
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
  getReportBySessionId: (sessionId: string) => Promise<Report | null>;
  getCorrectionsByTurnIds: (turnIds: string[]) => Promise<Map<string, Correction[]>>;
  listTurnsBySessionId: (sessionId: string) => Promise<{ id: string }[]>;
  prepareShadowingGeneration: (
    sessionId: string,
  ) => Promise<PrepareShadowingGenerationResult>;
  replaceShadowingItemsForSession: (input: {
    sessionId: string;
    items: Array<{
      sessionId: string;
      standardText: string;
      originalText?: string;
      reason?: string;
      source: ShadowingItem["source"];
      turnId?: string;
      sortOrder: number;
      standardAudioStatus: "pending" | "ready" | "failed";
      standardAudio?: ShadowingItem["standardAudio"];
    }>;
  }) => Promise<ShadowingItem[]>;
  updateShadowingItemStandardAudio: (
    itemId: string,
    input: {
      standardAudio?: ShadowingItem["standardAudio"];
      standardAudioStatus: "pending" | "ready" | "failed";
    },
  ) => Promise<ShadowingItem | null>;
};

export async function generateSessionShadowingContent(
  payload: ShadowingGeneratePayload,
  deps: GenerateSessionShadowingDeps,
  context: { attempts: number },
): Promise<GenerateSessionShadowingResult> {
  const session = await deps.getSessionById(payload.sessionId);
  if (!session) {
    throw new JobProcessingError({
      code: "not_found",
      message: `Session ${payload.sessionId} was not found.`,
      attempts: context.attempts,
      retryable: false,
    });
  }

  if (session.status !== "completed") {
    throw new JobProcessingError({
      code: "validation",
      message: "Shadowing content can only be generated for completed sessions.",
      attempts: context.attempts,
      retryable: false,
    });
  }

  const report = await deps.getReportBySessionId(payload.sessionId);
  if (!report) {
    throw new JobProcessingError({
      code: "processing",
      message: "Session report must be ready before generating shadowing content.",
      attempts: context.attempts,
      retryable: true,
    });
  }

  const preparation = await deps.prepareShadowingGeneration(payload.sessionId);
  if (preparation.status === "complete") {
    return {
      items: preparation.items,
      created: false,
    };
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

  const turns = await deps.listTurnsBySessionId(payload.sessionId);
  const correctionsByTurnId = await deps.getCorrectionsByTurnIds(
    turns.map((turn) => turn.id),
  );

  const selected = selectShadowingItems({
    scenario,
    shadowingRecommendations: report.shadowingRecommendations,
    correctionsByTurnId,
  });

  const pendingItems = await deps.replaceShadowingItemsForSession({
    sessionId: payload.sessionId,
    items: selected.map((item, index) => ({
      sessionId: payload.sessionId,
      standardText: item.standardText,
      originalText: item.originalText,
      reason: item.reason,
      source: item.source,
      turnId: item.turnId,
      sortOrder: index,
      standardAudioStatus: "pending",
    })),
  });

  const items: ShadowingItem[] = [];

  for (const item of pendingItems) {
    try {
      const withAudio = await attachStandardAudioToShadowingItem(item, {
        ttsProvider: deps.ttsProvider,
        defaultVoice: deps.defaultVoice,
      });

      const updated = await deps.updateShadowingItemStandardAudio(item.id, {
        standardAudio: withAudio.standardAudio,
        standardAudioStatus: "ready",
      });

      items.push(updated ?? withAudio);
    } catch (error) {
      if (isProviderError(error)) {
        throw new JobProcessingError({
          code: "provider_error",
          message: error.message,
          attempts: context.attempts,
          retryable: true,
          cause: error,
        });
      }

      const failed = await deps.updateShadowingItemStandardAudio(item.id, {
        standardAudioStatus: "failed",
      });

      items.push(
        failed ?? {
          ...item,
          standardAudioStatus: "failed",
        },
      );
    }
  }

  return {
    items,
    created: true,
  };
}
