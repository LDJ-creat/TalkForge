import { createProviderError } from "@/providers/errors";
import type { RealtimeProvider } from "@/providers/realtime/contract";
import type {
  CreateRealtimeSessionInput,
  RealtimeSessionCredentials,
} from "@/providers/realtime/types";
import { executeProviderCall } from "@/providers/runtime";

import {
  buildQwenOmniRealtimeEndpoint,
  DEFAULT_QWEN_OMNI_API_BASE_URL,
  DEFAULT_QWEN_OMNI_MODEL,
  DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC,
  DEFAULT_QWEN_OMNI_VOICE,
  MAX_QWEN_OMNI_TOKEN_TTL_SEC,
  QWEN_OMNI_PROVIDER_NAME,
  resolveQwenOmniEndpoints,
  type QwenOmniProviderConfig,
} from "./config";
import {
  buildQwenOmniSessionConfig,
  buildQwenOmniSessionUpdateEvent,
} from "./session-config";
import { mintQwenOmniTemporaryToken } from "./token-client";

export type CreateQwenOmniRealtimeProviderOptions = Partial<QwenOmniProviderConfig> & {
  apiKey: string;
  apiBaseUrl?: string;
};

function resolveTokenTtlSec(requested?: number, configured?: number): number {
  const ttl = requested ?? configured ?? DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC;
  return Math.min(Math.max(ttl, 1), MAX_QWEN_OMNI_TOKEN_TTL_SEC);
}

function buildPendingProviderSessionId(sessionId: string): string {
  return `pending:${sessionId}`;
}

export class QwenOmniRealtimeProvider implements RealtimeProvider {
  readonly name = QWEN_OMNI_PROVIDER_NAME;
  private readonly config: QwenOmniProviderConfig;

  constructor(options: CreateQwenOmniRealtimeProviderOptions) {
    if (!options.apiKey.trim()) {
      throw createProviderError({
        provider: QWEN_OMNI_PROVIDER_NAME,
        code: "configuration",
        message: "REALTIME_API_KEY is required for the Qwen Omni realtime provider.",
        retryable: false,
      });
    }

    const apiBaseUrl = options.apiBaseUrl ?? options.endpoints?.apiBaseUrl;
    this.config = {
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_QWEN_OMNI_MODEL,
      voice: options.voice ?? DEFAULT_QWEN_OMNI_VOICE,
      tokenTtlSec: options.tokenTtlSec ?? DEFAULT_QWEN_OMNI_TOKEN_TTL_SEC,
      endpoints:
        options.endpoints ??
        resolveQwenOmniEndpoints(apiBaseUrl ?? DEFAULT_QWEN_OMNI_API_BASE_URL),
    };
  }

  async createSession(input: CreateRealtimeSessionInput): Promise<RealtimeSessionCredentials> {
    const expireInSec = resolveTokenTtlSec(input.expiresInSec, this.config.tokenTtlSec);
    const sessionConfig = buildQwenOmniSessionConfig({
      instructions: input.systemInstructions,
      voice: this.config.voice,
    });

    const { result } = await executeProviderCall({
      provider: this.name,
      operation: "realtime.session.create",
      fn: async (context) =>
        mintQwenOmniTemporaryToken({
          apiKey: this.config.apiKey,
          endpoints: this.config.endpoints,
          expireInSec,
          providerName: this.name,
          context,
        }),
    });

    return {
      provider: this.name,
      providerSessionId: buildPendingProviderSessionId(input.sessionId),
      token: result.token,
      expiresAt: result.expiresAt,
      connectionMode: "websocket",
      endpointUrl: buildQwenOmniRealtimeEndpoint(this.config.endpoints, this.config.model),
      metadata: {
        model: this.config.model,
        voice: this.config.voice,
        userId: input.userId,
        sessionId: input.sessionId,
        scenarioId: input.scenarioId,
        sessionUpdateEvent: buildQwenOmniSessionUpdateEvent(sessionConfig),
        instructionsIncluded: true,
        providerSessionIdPending: true,
      },
    };
  }
}

export function createQwenOmniRealtimeProvider(
  options: CreateQwenOmniRealtimeProviderOptions,
): QwenOmniRealtimeProvider {
  return new QwenOmniRealtimeProvider(options);
}
