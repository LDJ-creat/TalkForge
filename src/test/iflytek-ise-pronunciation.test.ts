import { describe, expect, it, vi } from "vitest";

import {
  buildIflytekIseAuthUrl,
  buildIflytekIseReferenceText,
  createIflytekIsePronunciationProvider,
  DEFAULT_IFLYTEK_ISE_WS_URL,
  IFLYTEK_ISE_PROVIDER_NAME,
  normalizeIflytekIseEvaluation,
  parseIflytekIseReadSentenceScores,
  parseIflytekIseWordDetails,
} from "@/providers/iflytek-ise";

const RECORDED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xml_result>
  <read_sentence accuracy_score="86.5" fluency_score="80.2" integrity_score="88.0" standard_score="82.1" total_score="84.3" beg_pos="0" end_pos="120" content="Could I get a medium latte?" time_len="2200">
    <word beg_pos="0" content="Could" total_score="90.0" dp_message="0"/>
    <word beg_pos="20" content="I" total_score="88.0" dp_message="0"/>
    <word beg_pos="30" content="get" total_score="85.0" dp_message="0"/>
    <word beg_pos="50" content="a" total_score="92.0" dp_message="0"/>
    <word beg_pos="60" content="medium" total_score="79.0" dp_message="16"/>
    <word beg_pos="90" content="latte" total_score="83.0" dp_message="0"/>
  </read_sentence>
</xml_result>`;

describe("iFlytek ISE pronunciation adapter", () => {
  it("builds authenticated WebSocket URLs with required query params", () => {
    const url = buildIflytekIseAuthUrl({
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
      wsBaseUrl: DEFAULT_IFLYTEK_ISE_WS_URL,
    });

    const parsed = new URL(url);
    expect(parsed.protocol).toBe("wss:");
    expect(parsed.host).toBe("ise-api.xfyun.cn");
    expect(parsed.searchParams.get("authorization")).toBeTruthy();
    expect(parsed.searchParams.get("date")).toBeTruthy();
    expect(parsed.searchParams.get("host")).toBe("ise-api.xfyun.cn");
  });

  it("formats shadowing reference text for read_sentence mode", () => {
    expect(buildIflytekIseReferenceText("Could I get a medium latte?")).toBe(
      "[content]Could I get a medium latte?",
    );
    expect(buildIflytekIseReferenceText("[content]Already formatted")).toBe(
      "[content]Already formatted",
    );
  });

  it("parses read_sentence scores from provider XML fixtures", () => {
    const scores = parseIflytekIseReadSentenceScores(RECORDED_XML);

    expect(scores.totalScore).toBeCloseTo(84.3);
    expect(scores.accuracyScore).toBeCloseTo(86.5);
    expect(scores.fluencyScore).toBeCloseTo(80.2);
    expect(scores.completenessScore).toBeCloseTo(88);
    expect(scores.standardScore).toBeCloseTo(82.1);
  });

  it("parses word-level details from provider XML fixtures", () => {
    const words = parseIflytekIseWordDetails(RECORDED_XML);

    expect(words).toHaveLength(6);
    expect(words[4]).toMatchObject({
      word: "medium",
      score: 79,
      dpMessage: 16,
    });
  });

  it("normalizes provider responses into TalkForge shadowing scores", () => {
    const result = normalizeIflytekIseEvaluation(
      {
        code: 0,
        message: "success",
        sid: "ise-session-123",
        data: {
          status: 2,
          data: Buffer.from(RECORDED_XML, "utf8").toString("base64"),
        },
      },
      {
        referenceText: "Could I get a medium latte?",
        mode: "shadowing",
      },
    );

    expect(result.provider).toBe(IFLYTEK_ISE_PROVIDER_NAME);
    expect(result.mode).toBe("shadowing");
    expect(result.overallScore).toBeCloseTo(84.3);
    expect(result.accuracyScore).toBeCloseTo(86.5);
    expect(result.completenessScore).toBeCloseTo(88);
    expect(result.details).toMatchObject({
      referenceText: "Could I get a medium latte?",
      recordId: "ise-session-123",
      words: expect.arrayContaining([
        expect.objectContaining({ word: "medium", score: 79 }),
      ]),
    });
  });

  it("evaluates shadowing audio through the injected WebSocket client", async () => {
    const evaluateAudio = vi.fn().mockResolvedValue({
      code: 0,
      message: "success",
      sid: "ise-session-123",
      data: {
        status: 2,
        data: Buffer.from(RECORDED_XML, "utf8").toString("base64"),
      },
    });

    const provider = createIflytekIsePronunciationProvider({
      appId: "app-test",
      apiKey: "key-test",
      apiSecret: "secret-test",
      loadAudio: async () => ({
        objectKey: "audio/session/turn.webm",
        body: Buffer.from("fake-audio"),
        contentType: "audio/webm",
      }),
      prepareAudio: async () => Buffer.alloc(3200),
      evaluateAudio,
    });

    const result = await provider.evaluate({
      audioObjectKey: "audio/session/turn.webm",
      mode: "shadowing",
      referenceText: "Could I get a medium latte?",
    });

    expect(result.overallScore).toBeCloseTo(84.3);
    expect(evaluateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "app-test",
        apiKey: "key-test",
        apiSecret: "secret-test",
      }),
      expect.objectContaining({
        pcmAudio: expect.any(Buffer),
        referenceText: "Could I get a medium latte?",
      }),
    );
  });

  it("evaluates free_speech audio when ASR reference text is provided", async () => {
    const evaluateAudio = vi.fn().mockResolvedValue({
      code: 0,
      message: "success",
      sid: "ise-session-456",
      data: {
        status: 2,
        data: Buffer.from(RECORDED_XML, "utf8").toString("base64"),
      },
    });

    const provider = createIflytekIsePronunciationProvider({
      appId: "app-test",
      apiKey: "key-test",
      apiSecret: "secret-test",
      loadAudio: async () => ({
        objectKey: "audio/session/turn.webm",
        body: Buffer.from("fake-audio"),
      }),
      prepareAudio: async () => Buffer.alloc(3200),
      evaluateAudio,
    });

    const result = await provider.evaluate({
      audioObjectKey: "audio/session/turn.webm",
      mode: "free_speech",
      referenceText: "Could I get a medium latte?",
    });

    expect(result.mode).toBe("free_speech");
    expect(result.overallScore).toBeCloseTo(84.3);
    expect(evaluateAudio).toHaveBeenCalled();
  });

  it("rejects free_speech mode without reference text", async () => {
    const provider = createIflytekIsePronunciationProvider({
      appId: "app-test",
      apiKey: "key-test",
      apiSecret: "secret-test",
      loadAudio: async () => ({
        objectKey: "audio/session/turn.webm",
        body: Buffer.from("fake-audio"),
      }),
    });

    await expect(
      provider.evaluate({
        audioObjectKey: "audio/session/turn.webm",
        mode: "free_speech",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
  });

  it("maps missing audio objects to non-retryable not_found errors", async () => {
    const provider = createIflytekIsePronunciationProvider({
      appId: "app-test",
      apiKey: "key-test",
      apiSecret: "secret-test",
      loadAudio: async () => {
        throw new Error("Audio object missing");
      },
    });

    await expect(
      provider.evaluate({
        audioObjectKey: "audio/session/missing.webm",
        mode: "shadowing",
        referenceText: "Could I get a medium latte?",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      retryable: false,
    });
  });
});
