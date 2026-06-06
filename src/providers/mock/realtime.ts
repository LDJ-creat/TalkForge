import { createProviderError } from "../errors";
import type { RealtimeProvider } from "../realtime/contract";
import type {
  CreateRealtimeSessionInput,
  RealtimeSessionCredentials,
  RevokeRealtimeSessionInput,
} from "../realtime/types";
import { addSecondsIso, createMockId } from "./utils";

export type MockRealtimeProviderOptions = {
  name?: string;
  connectionMode?: RealtimeSessionCredentials["connectionMode"];
  defaultExpiresInSec?: number;
  endpointUrl?: string;
  failOnCreate?: boolean;
};

export class MockRealtimeProvider implements RealtimeProvider {
  readonly name: string;
  private readonly connectionMode: RealtimeSessionCredentials["connectionMode"];
  private readonly defaultExpiresInSec: number;
  private readonly endpointUrl?: string;
  private readonly failOnCreate: boolean;
  private readonly activeSessions = new Set<string>();

  constructor(options: MockRealtimeProviderOptions = {}) {
    this.name = options.name ?? "mock-realtime";
    this.connectionMode = options.connectionMode ?? "websocket";
    this.defaultExpiresInSec = options.defaultExpiresInSec ?? 300;
    this.endpointUrl = options.endpointUrl ?? "wss://mock.talkforge.local/realtime";
    this.failOnCreate = options.failOnCreate ?? false;
  }

  async createSession(input: CreateRealtimeSessionInput): Promise<RealtimeSessionCredentials> {
    if (this.failOnCreate) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock realtime provider is configured to fail.",
      });
    }

    const expiresInSec = input.expiresInSec ?? this.defaultExpiresInSec;
    const now = new Date().toISOString();
    const providerSessionId = createMockId("rt_session");
    this.activeSessions.add(providerSessionId);

    return {
      provider: this.name,
      providerSessionId,
      token: createMockId("rt_token"),
      expiresAt: addSecondsIso(now, expiresInSec),
      connectionMode: this.connectionMode,
      endpointUrl: this.endpointUrl,
      metadata: {
        userId: input.userId,
        sessionId: input.sessionId,
        scenarioId: input.scenarioId,
        mock: true,
      },
    };
  }

  async revokeSession(input: RevokeRealtimeSessionInput): Promise<void> {
    if (!this.activeSessions.has(input.providerSessionId)) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Realtime session ${input.providerSessionId} was not found.`,
      });
    }

    this.activeSessions.delete(input.providerSessionId);
  }

  hasSession(providerSessionId: string): boolean {
    return this.activeSessions.has(providerSessionId);
  }
}

export function createMockRealtimeProvider(
  options?: MockRealtimeProviderOptions,
): MockRealtimeProvider {
  return new MockRealtimeProvider(options);
}
