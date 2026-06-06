import type { Scenario } from "@/domain/scenario";
import type { RealtimeSessionCredentials } from "@/providers/realtime/types";

import type { TranscriptEntry } from "./types";

const MOCK_CONNECT_DELAY_MS = 400;
const MOCK_DISCONNECT_DELAY_MS = 250;
const MOCK_REALTIME_PROVIDER = "mock-realtime";
const MOCK_ENDPOINT_URL = "wss://mock.talkforge.local/realtime";

export type MockRealtimeSessionOptions = {
  failOnStart?: boolean;
  failOnStop?: boolean;
};

let mockOptions: MockRealtimeSessionOptions = {};

export function setMockRealtimeSessionOptions(options: MockRealtimeSessionOptions): void {
  mockOptions = options;
}

export function resetMockRealtimeSessionOptions(): void {
  mockOptions = {};
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createMockId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createConversationSessionId(): string {
  return crypto.randomUUID();
}

export async function mockStartRealtimeSession(input: {
  sessionId: string;
  scenario: Scenario;
  userId?: string;
}): Promise<RealtimeSessionCredentials> {
  await delay(MOCK_CONNECT_DELAY_MS);

  if (mockOptions.failOnStart) {
    throw new Error("Mock realtime session start failed.");
  }

  return {
    provider: MOCK_REALTIME_PROVIDER,
    providerSessionId: createMockId(`rt_${input.scenario.id}`),
    token: createMockId("rt_token"),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    connectionMode: "websocket",
    endpointUrl: MOCK_ENDPOINT_URL,
    metadata: {
      sessionId: input.sessionId,
      scenarioId: input.scenario.id,
      mock: true,
    },
  };
}

export async function mockStopRealtimeSession(): Promise<void> {
  await delay(MOCK_DISCONNECT_DELAY_MS);

  if (mockOptions.failOnStop) {
    throw new Error("Mock realtime session stop failed.");
  }
}

export function createOpeningTranscript(scenario: Scenario): TranscriptEntry {
  const stage = scenario.stages[0];
  const greeting =
    stage?.aiBehavior ??
    `Welcome to ${scenario.title}. When you are ready, start speaking.`;

  return {
    id: createMockId("transcript"),
    role: "assistant",
    text: greeting,
    status: "final",
    timestamp: new Date().toISOString(),
  };
}
