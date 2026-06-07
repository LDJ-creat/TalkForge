import { randomUUID } from "node:crypto";

import type {
  AiInvocationLog,
  AiInvocationOperation,
  AiInvocationStatus,
  AiInvocationUsageMetrics,
  CreateAiInvocationLogInput,
} from "@/domain/ai-invocation-log";
import type { ProviderErrorCode } from "@/providers/errors";
import type { ProviderCallMetadata } from "@/providers/runtime";
import type { AiTracingConfig } from "@/server/config/types";
import { createAiInvocationLog } from "@/server/db/repositories/ai-invocation-log-repository";
import type { TalkForgeDatabase } from "@/server/db/client";

import { getAiTracingConfig, shouldSampleAiTrace } from "./config";
import { logAiTracingWarning } from "./log";
import { redactTraceValue } from "./redact";
import {
  resetRawTraceWriterForTests,
  writeRawTraces,
  type RawTraceWriterDependencies,
} from "./writers/raw-trace-writer";

export type AiInvocationTraceContext = {
  sessionId?: string;
  turnId?: string;
  jobId?: string;
  model: string;
  operation: AiInvocationOperation;
  promptVersion?: string;
  inputObjectKey?: string;
  outputObjectKey?: string;
  requestSummary?: unknown;
  responseSummary?: unknown;
  rawRequest?: unknown;
  rawResponse?: unknown;
  usage?: AiInvocationUsageMetrics;
};

export type RecordAiInvocationTraceInput = AiInvocationTraceContext & {
  provider: string;
  metadata: ProviderCallMetadata;
  errorMessage?: string;
};

export type AiInvocationTraceWriter = {
  record(input: RecordAiInvocationTraceInput): Promise<AiInvocationLog | null>;
};

export type AiInvocationTraceServiceOptions = {
  db: TalkForgeDatabase;
  config?: AiTracingConfig;
  rawTraceDeps?: RawTraceWriterDependencies;
  random?: () => number;
  createId?: () => string;
};

function mapProviderStatus(
  metadata: ProviderCallMetadata,
): AiInvocationStatus {
  if (metadata.status === "success") {
    return "success";
  }

  switch (metadata.errorCode as ProviderErrorCode | undefined) {
    case "timeout":
      return "timeout";
    case "rate_limited":
      return "rate_limited";
    default:
      return "failed";
  }
}

function summarizePayload(
  value: unknown,
  redactPii: boolean,
): unknown | undefined {
  if (value === undefined) {
    return undefined;
  }
  return redactTraceValue(value, redactPii);
}

function summarizeTraceFailure(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown tracing failure.";
}

export function createAiInvocationTraceService(
  options: AiInvocationTraceServiceOptions,
): AiInvocationTraceWriter {
  const config = options.config ?? getAiTracingConfig();
  const random = options.random ?? Math.random;
  const createId = options.createId ?? randomUUID;

  return {
    async record(input) {
      if (!config.enabled || !shouldSampleAiTrace(config, random())) {
        return null;
      }

      const logId = createId();

      try {
        const rawKeys = await writeRawTraces(
          {
            config,
            ...options.rawTraceDeps,
          },
          {
            logId,
            rawRequest: input.rawRequest,
            rawResponse: input.rawResponse,
          },
        );

        const record: CreateAiInvocationLogInput = {
          sessionId: input.sessionId,
          turnId: input.turnId,
          jobId: input.jobId,
          provider: input.provider,
          model: input.model,
          operation: input.operation,
          promptVersion: input.promptVersion,
          inputObjectKey: input.inputObjectKey,
          outputObjectKey: input.outputObjectKey,
          requestSummary: summarizePayload(input.requestSummary, config.redactPii),
          responseSummary: summarizePayload(input.responseSummary, config.redactPii),
          rawRequestObjectKey: rawKeys.rawRequestObjectKey,
          rawResponseObjectKey: rawKeys.rawResponseObjectKey,
          status: mapProviderStatus(input.metadata),
          latencyMs: input.metadata.latencyMs,
          retryCount: input.metadata.retryCount,
          inputTokens: input.usage?.inputTokens,
          outputTokens: input.usage?.outputTokens,
          audioDurationMs: input.usage?.audioDurationMs,
          costEstimate: input.usage?.costEstimate,
          errorCode: input.metadata.errorCode,
          errorMessage: input.errorMessage,
        };

        return await createAiInvocationLog(options.db, { ...record, id: logId });
      } catch (error) {
        logAiTracingWarning("record_failed", {
          logId,
          provider: input.provider,
          operation: input.operation,
          model: input.model,
          message: summarizeTraceFailure(error),
        });
        return null;
      }
    },
  };
}

export function resetAiInvocationTracingForTests(): void {
  resetRawTraceWriterForTests();
}

export { getAiTracingConfig, shouldSampleAiTrace } from "./config";
export { redactTraceValue, serializeTracePayload } from "./redact";
export {
  buildAiTraceObjectKey,
  buildAiTraceLocalRelativePath,
} from "./object-keys";
export { formatRawTraceReference, parseRawTraceReference } from "./trace-ref";
