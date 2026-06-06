import type { RealtimeSessionCredentials } from "@/providers/realtime/types";

export type ConversationRealtimeCredentials = Pick<
  RealtimeSessionCredentials,
  "provider" | "providerSessionId" | "token" | "expiresAt" | "connectionMode" | "endpointUrl"
>;

export function mapRealtimeCredentials(
  credentials: RealtimeSessionCredentials,
): ConversationRealtimeCredentials {
  return {
    provider: credentials.provider,
    providerSessionId: credentials.providerSessionId,
    token: credentials.token,
    expiresAt: credentials.expiresAt,
    connectionMode: credentials.connectionMode,
    endpointUrl: credentials.endpointUrl,
  };
}
