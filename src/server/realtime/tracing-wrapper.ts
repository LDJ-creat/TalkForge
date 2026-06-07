import type { AiInvocationOperation } from "@/domain/ai-invocation-log";
import type { RealtimeProvider } from "@/providers/realtime/contract";
import type {
  CreateRealtimeSessionInput,
  RealtimeSessionCredentials,
} from "@/providers/realtime/types";

import type { AiInvocationTraceWriter } from "@/server/ai-tracing";
import { executeTracedProviderCall } from "@/server/ai-tracing";

const REALTIME_SESSION_CREATE_OPERATION: AiInvocationOperation =
  "realtime.session.create";

export type TracedRealtimeProviderOptions = {
  model: string;
  promptVersion?: string;
};

export function createTracedRealtimeProvider(
  provider: RealtimeProvider,
  traceWriter: AiInvocationTraceWriter,
  options: TracedRealtimeProviderOptions,
): RealtimeProvider {
  return {
    name: provider.name,
    async createSession(
      input: CreateRealtimeSessionInput,
    ): Promise<RealtimeSessionCredentials> {
      const { result } = await executeTracedProviderCall({
        traceWriter,
        provider: provider.name,
        model: options.model,
        operation: REALTIME_SESSION_CREATE_OPERATION,
        sessionId: input.sessionId,
        promptVersion: options.promptVersion,
        requestSummary: {
          scenarioId: input.scenarioId,
          userId: input.userId,
          expiresInSec: input.expiresInSec,
          instructionsLength: input.systemInstructions.length,
        },
        rawRequest: {
          scenarioId: input.scenarioId,
          sessionId: input.sessionId,
          expiresInSec: input.expiresInSec,
          systemInstructions: input.systemInstructions,
        },
        fn: () => provider.createSession(input),
        extractResponseSummary: (credentials) => ({
          providerSessionId: credentials.providerSessionId,
          connectionMode: credentials.connectionMode,
          expiresAt: credentials.expiresAt,
          endpointUrl: credentials.endpointUrl,
          instructionsIncluded: credentials.metadata?.instructionsIncluded === true,
        }),
        extractRawResponse: (credentials) => ({
          providerSessionId: credentials.providerSessionId,
          connectionMode: credentials.connectionMode,
          expiresAt: credentials.expiresAt,
          endpointUrl: credentials.endpointUrl,
          tokenPrefix: credentials.token.slice(0, 8),
          metadata: credentials.metadata,
        }),
      });

      return result;
    },
    revokeSession: provider.revokeSession?.bind(provider),
  };
}
