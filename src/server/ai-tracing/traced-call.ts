import type { AiInvocationOperation, AiInvocationUsageMetrics } from "@/domain/ai-invocation-log";
import { isProviderError } from "@/providers/errors";
import {
  executeProviderCall,
  type ExecuteProviderCallOptions,
  type ExecuteProviderCallResult,
  type ProviderCallContext,
  type ProviderCallMetadata,
} from "@/providers/runtime";

import type { AiInvocationTraceContext, AiInvocationTraceWriter } from "./service";

export type TracedProviderCallContext = AiInvocationTraceContext & {
  provider: string;
};

export type TracedProviderCallResult<T> = ExecuteProviderCallResult<T> & {
  trace: Awaited<ReturnType<AiInvocationTraceWriter["record"]>>;
};

export type ExecuteTracedProviderCallOptions<T> = Omit<
  ExecuteProviderCallOptions<T>,
  "provider" | "operation" | "onComplete"
> &
  TracedProviderCallContext & {
    traceWriter: AiInvocationTraceWriter;
    extractUsage?: (result: T) => AiInvocationUsageMetrics | undefined;
    extractResponseSummary?: (result: T) => unknown;
    extractRawResponse?: (result: T) => unknown;
  };

export async function executeTracedProviderCall<T>(
  options: ExecuteTracedProviderCallOptions<T>,
): Promise<TracedProviderCallResult<T>> {
  const {
    traceWriter,
    sessionId,
    turnId,
    jobId,
    model,
    operation,
    promptVersion,
    inputObjectKey,
    outputObjectKey,
    requestSummary,
    rawRequest,
    usage: presetUsage,
    extractUsage,
    extractResponseSummary,
    extractRawResponse,
    provider,
    ...executeOptions
  } = options;

  let failureMetadata: ProviderCallMetadata | undefined;

  try {
    const { result, metadata } = await executeProviderCall({
      ...executeOptions,
      provider,
      operation,
      observability: {
        sessionId,
        turnId,
        jobId,
        costEstimate: presetUsage?.costEstimate,
      },
      onComplete: (completedMetadata) => {
        if (completedMetadata.status === "error") {
          failureMetadata = completedMetadata;
        }
      },
    });

    const usage = presetUsage ?? extractUsage?.(result);

    const trace = await traceWriter.record({
      provider,
      model,
      operation,
      sessionId,
      turnId,
      jobId,
      promptVersion,
      inputObjectKey,
      outputObjectKey,
      requestSummary,
      responseSummary: extractResponseSummary?.(result),
      rawRequest,
      rawResponse: extractRawResponse?.(result),
      usage,
      metadata,
    });

    return { result, metadata, trace };
  } catch (error) {
    const normalized = isProviderError(error) ? error : undefined;
    const metadata =
      failureMetadata ??
      ({
        provider,
        operation,
        latencyMs: 0,
        status: "error",
        retryCount: 0,
        errorCode: normalized?.code,
      } satisfies ProviderCallMetadata);

    await traceWriter.record({
      provider,
      model,
      operation,
      sessionId,
      turnId,
      jobId,
      promptVersion,
      inputObjectKey,
      outputObjectKey,
      requestSummary,
      rawRequest,
      usage: presetUsage,
      metadata,
      errorMessage:
        normalized?.message ?? (error instanceof Error ? error.message : undefined),
    });

    throw error;
  }
}

export type CreateTracedProviderFnOptions<TInput, TResult> = {
  traceWriter: AiInvocationTraceWriter;
  provider: string;
  operation: AiInvocationOperation;
  model: string;
  /**
   * Provide trace context explicitly. Raw request/response payloads are not
   * inferred from `input` automatically to avoid logging large or sensitive data.
   */
  buildContext?: (input: TInput) => Partial<AiInvocationTraceContext>;
  invoke: (input: TInput, context: ProviderCallContext) => Promise<TResult>;
  extractUsage?: (result: TResult) => AiInvocationUsageMetrics | undefined;
  extractResponseSummary?: (result: TResult) => unknown;
  extractRawResponse?: (result: TResult) => unknown;
  execute?: typeof executeTracedProviderCall;
};

export function createTracedProviderFn<TInput, TResult>(
  options: CreateTracedProviderFnOptions<TInput, TResult>,
) {
  const execute = options.execute ?? executeTracedProviderCall;

  return async (input: TInput): Promise<TracedProviderCallResult<TResult>> => {
    const context = options.buildContext?.(input) ?? {};

    return execute({
      traceWriter: options.traceWriter,
      provider: options.provider,
      model: context.model ?? options.model,
      operation: options.operation,
      sessionId: context.sessionId,
      turnId: context.turnId,
      jobId: context.jobId,
      promptVersion: context.promptVersion,
      inputObjectKey: context.inputObjectKey,
      outputObjectKey: context.outputObjectKey,
      requestSummary: context.requestSummary,
      rawRequest: context.rawRequest,
      fn: (callContext) => options.invoke(input, callContext),
      extractUsage: options.extractUsage,
      extractResponseSummary: options.extractResponseSummary,
      extractRawResponse: options.extractRawResponse,
    });
  };
}
