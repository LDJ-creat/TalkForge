import type { RealtimeSessionCredentials } from "@/providers/realtime/types";
import { normalizeQwenOmniSessionUpdateEvent } from "@/providers/qwen-omni/normalize-session-update";
import { QWEN_OMNI_PROVIDER_NAME } from "@/providers/qwen-omni/config";

export type ConversationRealtimeCredentials = Pick<
  RealtimeSessionCredentials,
  | "provider"
  | "providerSessionId"
  | "token"
  | "expiresAt"
  | "connectionMode"
  | "endpointUrl"
  | "metadata"
>;

export function mapRealtimeCredentials(
  credentials: RealtimeSessionCredentials,
): ConversationRealtimeCredentials {
  const metadata = credentials.metadata;

  if (credentials.provider !== QWEN_OMNI_PROVIDER_NAME || !metadata) {
    return {
      provider: credentials.provider,
      providerSessionId: credentials.providerSessionId,
      token: credentials.token,
      expiresAt: credentials.expiresAt,
      connectionMode: credentials.connectionMode,
      endpointUrl: credentials.endpointUrl,
      metadata,
    };
  }

  const model = typeof metadata.model === "string" ? metadata.model : undefined;
  const configuredVoice =
    typeof metadata.voice === "string" ? metadata.voice : undefined;
  const sessionUpdateEvent = normalizeQwenOmniSessionUpdateEvent(
    model,
    configuredVoice,
    metadata.sessionUpdateEvent,
  );

  return {
    provider: credentials.provider,
    providerSessionId: credentials.providerSessionId,
    token: credentials.token,
    expiresAt: credentials.expiresAt,
    connectionMode: credentials.connectionMode,
    endpointUrl: credentials.endpointUrl,
    metadata: {
      ...metadata,
      voice: sessionUpdateEvent?.session.voice ?? configuredVoice,
      sessionUpdateEvent: sessionUpdateEvent ?? metadata.sessionUpdateEvent,
    },
  };
}
