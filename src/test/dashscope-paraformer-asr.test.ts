import { describe, expect, it, vi } from "vitest";

import {
  buildDashScopeInferenceWebSocketUrl,
  createDashScopeParaformerAsrProvider,
  DEFAULT_DASHSCOPE_API_BASE_URL,
  DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
  DASHSCOPE_PARAFORMER_PROVIDER_NAME,
  normalizeDashScopeParaformerResponse,
  type DashScopeParaformerSentence,
} from "@/providers/dashscope-paraformer";

const RECORDED_SENTENCES: DashScopeParaformerSentence[] = [
  {
    begin_time: 0,
    end_time: 2200,
    text: "Could I get a medium latte, please?",
    heartbeat: false,
    sentence_end: true,
    emo_confidence: 0.91,
    words: [
      { begin_time: 0, end_time: 250, text: "Could", punctuation: "," },
      { begin_time: 250, end_time: 420, text: "I", punctuation: "" },
      { begin_time: 420, end_time: 620, text: "get", punctuation: "" },
      { begin_time: 620, end_time: 700, text: "a", punctuation: "" },
      { begin_time: 700, end_time: 1100, text: "medium", punctuation: "" },
      { begin_time: 1100, end_time: 1500, text: "latte", punctuation: "," },
      { begin_time: 1500, end_time: 2200, text: "please", punctuation: "?" },
    ],
  },
];

describe("DashScope Paraformer ASR adapter", () => {
  it("builds the inference WebSocket URL from the DashScope API base URL", () => {
    expect(buildDashScopeInferenceWebSocketUrl(DEFAULT_DASHSCOPE_API_BASE_URL)).toBe(
      "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
    );
  });

  it("normalizes result-generated sentences into TalkForge transcript segments", () => {
    const result = normalizeDashScopeParaformerResponse(RECORDED_SENTENCES, {
      audioObjectKey: "audio/session/turn.webm",
      language: "en",
      wordTimestamps: true,
      durationSec: 2.2,
    });

    expect(result.provider).toBe(DASHSCOPE_PARAFORMER_PROVIDER_NAME);
    expect(result.text).toBe("Could I get a medium latte, please?");
    expect(result.confidence).toBeCloseTo(0.91);
    expect(result.segments[0]?.words?.[0]).toMatchObject({
      word: "Could",
      startMs: 0,
      endMs: 250,
    });
    expect(result.metadata).toMatchObject({
      audioObjectKey: "audio/session/turn.webm",
      durationSec: 2.2,
    });
  });

  it("transcribes audio through the injected realtime client", async () => {
    const transcribeAudio = vi.fn().mockResolvedValue({
      sentences: RECORDED_SENTENCES,
      durationSec: 2.2,
    });

    const provider = createDashScopeParaformerAsrProvider({
      apiKey: "sk-test",
      model: DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
      loadAudio: async () => ({
        objectKey: "audio/session/turn.webm",
        body: Buffer.from("fake-audio"),
        contentType: "audio/webm",
      }),
      prepareAudio: async () => Buffer.alloc(3200),
      transcribeAudio,
    });

    const result = await provider.transcribe({
      audioObjectKey: "audio/session/turn.webm",
      language: "en",
      wordTimestamps: true,
    });

    expect(result.text).toBe("Could I get a medium latte, please?");
    expect(transcribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        model: DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
      }),
      expect.objectContaining({
        pcmAudio: expect.any(Buffer),
        language: "en",
        wordTimestamps: true,
      }),
    );
  });

  it("maps missing audio objects to non-retryable not_found errors", async () => {
    const provider = createDashScopeParaformerAsrProvider({
      apiKey: "sk-test",
      loadAudio: async () => {
        throw new Error("Audio object missing");
      },
    });

    await expect(
      provider.transcribe({
        audioObjectKey: "audio/session/missing.webm",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      retryable: false,
    });
  });
});
