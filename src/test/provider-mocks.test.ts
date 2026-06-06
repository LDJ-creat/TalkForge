import { describe, expect, it } from "vitest";

import { ProviderError } from "@/providers/errors";
import {
  createMockAsrProvider,
  createMockLlmProvider,
  createMockPronunciationEvaluationProvider,
  createMockProviderBundle,
  createMockRealtimeProvider,
  createMockStorageProvider,
  createMockTtsProvider,
} from "@/providers/mock";

describe("mock provider bundle", () => {
  it("creates all provider contracts for local development", () => {
    const providers = createMockProviderBundle();

    expect(providers.realtime.name).toBe("mock-realtime");
    expect(providers.asr.name).toBe("mock-asr");
    expect(providers.storage.name).toBe("mock-storage");
    expect(providers.tts.name).toBe("mock-tts");
    expect(providers.pronunciation.name).toBe("mock-pronunciation");
    expect(providers.llmCorrection.name).toBe("mock-llm");
    expect(providers.llmReport).toBe(providers.llmCorrection);
  });
});

describe("MockRealtimeProvider", () => {
  it("creates short-lived session credentials without exposing secrets", async () => {
    const provider = createMockRealtimeProvider();
    const credentials = await provider.createSession({
      userId: "user_1",
      sessionId: "session_1",
      scenarioId: "coffee_ordering_a2",
      systemInstructions: "You are a barista.",
      expiresInSec: 120,
    });

    expect(credentials.provider).toBe("mock-realtime");
    expect(credentials.token.length).toBeGreaterThan(0);
    expect(credentials.providerSessionId.length).toBeGreaterThan(0);
    expect(new Date(credentials.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(credentials.connectionMode).toBe("websocket");
    expect(credentials.metadata?.mock).toBe(true);
  });

  it("revokes active sessions and rejects unknown sessions", async () => {
    const provider = createMockRealtimeProvider();
    const credentials = await provider.createSession({
      userId: "user_1",
      sessionId: "session_1",
      scenarioId: "coffee_ordering_a2",
      systemInstructions: "You are a barista.",
    });

    await expect(provider.revokeSession({ providerSessionId: credentials.providerSessionId }))
      .resolves.toBeUndefined();

    await expect(provider.revokeSession({ providerSessionId: credentials.providerSessionId }))
      .rejects.toBeInstanceOf(ProviderError);
  });
});

describe("MockAsrProvider", () => {
  it("returns normalized transcript segments", async () => {
    const provider = createMockAsrProvider();
    const result = await provider.transcribe({
      audioObjectKey: "audio/session_1/turn_1.webm",
      wordTimestamps: true,
    });

    expect(result.provider).toBe("mock-asr");
    expect(result.text).toContain("turn_1.webm");
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments[0]?.words?.length).toBeGreaterThan(0);
  });

  it("supports preset transcripts and missing object errors", async () => {
    const provider = createMockAsrProvider({
      missingObjectKeys: new Set(["audio/missing.webm"]),
    });

    provider.setTranscript("audio/custom.webm", {
      text: "Could I get a medium latte?",
      confidence: 0.97,
      segments: [{ startMs: 0, endMs: 1200, text: "Could I get a medium latte?" }],
    });

    await expect(
      provider.transcribe({ audioObjectKey: "audio/missing.webm" }),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    const custom = await provider.transcribe({ audioObjectKey: "audio/custom.webm" });
    expect(custom.text).toBe("Could I get a medium latte?");
  });
});

describe("MockStorageProvider", () => {
  it("creates private upload targets and signed download URLs", async () => {
    const provider = createMockStorageProvider();
    const uploadTarget = await provider.createUploadTarget({
      objectKey: "audio/session_1/turn_1.webm",
      contentType: "audio/webm",
      sizeBytes: 4096,
    });

    expect(uploadTarget.method).toBe("PUT");
    expect(uploadTarget.headers?.["x-talkforge-visibility"]).toBe("private");
    expect(uploadTarget.uploadUrl).toContain("turn_1.webm");

    const downloadUrl = await provider.createDownloadUrl({
      objectKey: uploadTarget.objectKey,
    });

    expect(downloadUrl.downloadUrl).toContain("turn_1.webm");
    expect(await provider.objectExists?.({ objectKey: uploadTarget.objectKey })).toBe(true);
  });

  it("deletes stored objects and rejects missing downloads", async () => {
    const provider = createMockStorageProvider();

    await expect(
      provider.createDownloadUrl({ objectKey: "audio/missing.webm" }),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    await provider.createUploadTarget({
      objectKey: "audio/session_1/turn_2.webm",
      contentType: "audio/webm",
    });

    await provider.deleteObject({ objectKey: "audio/session_1/turn_2.webm" });
    expect(await provider.objectExists?.({ objectKey: "audio/session_1/turn_2.webm" })).toBe(
      false,
    );
  });
});

describe("MockTtsProvider", () => {
  it("generates normalized standard audio metadata", async () => {
    const provider = createMockTtsProvider();
    const result = await provider.synthesize({
      text: "Could I get a medium latte?",
      voice: "en-us-neutral",
    });

    expect(result.provider).toBe("mock-tts");
    expect(result.format).toBe("wav");
    expect(result.objectKey.startsWith("tts/")).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("caches repeated synthesis requests", async () => {
    const provider = createMockTtsProvider();
    const input = { text: "That's all, thank you." };

    const first = await provider.synthesize(input);
    const second = await provider.synthesize(input);

    expect(second.objectKey).toBe(first.objectKey);
    expect(second.metadata?.cached).toBe(true);
  });
});

describe("MockPronunciationEvaluationProvider", () => {
  it("returns lightweight scores for free speech", async () => {
    const provider = createMockPronunciationEvaluationProvider();
    const result = await provider.evaluate({
      audioObjectKey: "audio/session_1/turn_1.webm",
      mode: "free_speech",
    });

    expect(result.mode).toBe("free_speech");
    expect(result.fluencyScore).toBeDefined();
    expect(result.accuracyScore).toBeUndefined();
  });

  it("requires reference text for shadowing mode", async () => {
    const provider = createMockPronunciationEvaluationProvider();

    await expect(
      provider.evaluate({
        audioObjectKey: "audio/session_1/turn_1.webm",
        mode: "shadowing",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
    });

    const result = await provider.evaluate({
      audioObjectKey: "audio/session_1/turn_1.webm",
      mode: "shadowing",
      referenceText: "Could I get a medium latte?",
    });

    expect(result.accuracyScore).toBeDefined();
    expect(result.completenessScore).toBeDefined();
  });
});

describe("MockLlmProvider", () => {
  it("returns grammar corrections for high-confidence transcripts", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.analyzeCorrections({
      turnId: "turn_1",
      transcriptText: "I go to the cafe yesterday.",
      transcriptConfidence: 0.95,
      recentContext: [],
      scenarioLevel: "A2",
    });

    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]?.type).toBe("grammar");
  });

  it("marks low-confidence transcripts as asr_uncertain", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.analyzeCorrections({
      turnId: "turn_2",
      transcriptText: "maybe latte?",
      transcriptConfidence: 0.4,
      recentContext: [],
      scenarioLevel: "A2",
    });

    expect(result.corrections[0]?.type).toBe("asr_uncertain");
  });

  it("generates normalized report payloads", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.generateReport({
      sessionId: "session_1",
      scenario: {
        id: "coffee_ordering_a2",
        title: "Order Coffee at a Cafe",
        level: "A2",
        goals: [{ id: "choose_drink", description: "Choose a drink.", required: true }],
        evaluationRubric: { dimensions: ["task_completion", "fluency"] },
      },
      scenarioProgress: {
        sessionId: "session_1",
        currentStageId: "closing",
        completedGoalIds: ["choose_drink"],
        missingGoalIds: [],
        shouldSuggestEnding: true,
        offTopic: false,
        updatedAt: "2026-06-06T00:00:00.000Z",
      },
      turns: [
        {
          turnId: "turn_1",
          role: "user",
          text: "Could I get a medium latte?",
        },
      ],
    });

    expect(result.summary).toContain("Order Coffee at a Cafe");
    expect(result.taskCompletion.completedGoalIds).toEqual(["choose_drink"]);
    expect(result.shadowingRecommendations.length).toBeGreaterThan(0);
  });
});
