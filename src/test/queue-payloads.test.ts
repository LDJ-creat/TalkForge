import { describe, expect, it } from "vitest";

import {
  JOB_NAMES,
  validateAsrTranscribePayload,
  validateCorrectionAnalyzePayload,
  validateEvaluationFreeSpeechPayload,
  validateJobPayload,
  validateReportGeneratePayload,
  validateScenarioProgressEvaluatePayload,
} from "@/queue";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";
const TRANSCRIPT_ID = "44444444-4444-4444-8444-444444444444";

describe("job payload validation", () => {
  it("accepts valid ASR transcribe payloads", () => {
    const result = validateAsrTranscribePayload({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      audioObjectKey: "sessions/session-1/turn-1.webm",
      language: "en",
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.audioObjectKey).toContain("turn-1");
    }
  });

  it("rejects ASR payloads without object keys", () => {
    const result = validateAsrTranscribePayload({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((error) => error.field === "audioObjectKey")).toBe(
        true,
      );
    }
  });

  it("rejects non-uuid domain ids", () => {
    const result = validateAsrTranscribePayload({
      turnId: "turn-1",
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
      audioObjectKey: "sessions/session-1/turn-1.webm",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((error) => error.field === "turnId")).toBe(true);
    }
  });

  it("validates correction payloads with optional transcript id", () => {
    const withoutTranscript = validateCorrectionAnalyzePayload({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
    });
    const withTranscript = validateCorrectionAnalyzePayload({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      transcriptId: TRANSCRIPT_ID,
    });

    expect(withoutTranscript.valid).toBe(true);
    expect(withTranscript.valid).toBe(true);
  });

  it("validates evaluation payloads", () => {
    const result = validateEvaluationFreeSpeechPayload({
      turnId: TURN_ID,
      sessionId: SESSION_ID,
      audioSegmentId: AUDIO_SEGMENT_ID,
    });

    expect(result.valid).toBe(true);
  });

  it("validates scenario progress payloads", () => {
    const result = validateScenarioProgressEvaluatePayload({
      sessionId: SESSION_ID,
      triggerTurnId: TURN_ID,
    });

    expect(result.valid).toBe(true);
  });

  it("validates report generation payloads", () => {
    const result = validateReportGeneratePayload({
      sessionId: SESSION_ID,
    });

    expect(result.valid).toBe(true);
  });

  it("routes validation through the generic job payload helper", () => {
    for (const name of JOB_NAMES) {
      const invalid = validateJobPayload(name, {});
      expect(invalid.valid).toBe(false);
    }
  });
});
