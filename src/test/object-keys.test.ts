import { describe, expect, it } from "vitest";

import {
  assertValidStorageObjectKey,
  assertValidTurnAudioObjectKey,
  buildConvertedAudioArtifactObjectKey,
  buildTtsStandardAudioObjectKey,
  buildTurnAudioObjectKey,
  parseTurnAudioObjectKey,
} from "@/server/storage/object-keys";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";

describe("storage object keys", () => {
  it("builds and parses turn audio object keys", () => {
    const objectKey = buildTurnAudioObjectKey(SESSION_ID, TURN_ID);

    expect(objectKey).toBe(`audio/${SESSION_ID}/${TURN_ID}.webm`);
    expect(parseTurnAudioObjectKey(objectKey)).toEqual({
      sessionId: SESSION_ID,
      turnId: TURN_ID,
    });
    expect(() => assertValidTurnAudioObjectKey(objectKey)).not.toThrow();
    expect(() => assertValidStorageObjectKey(objectKey)).not.toThrow();
  });

  it("builds TTS standard audio object keys from content hashes", () => {
    const objectKey = buildTtsStandardAudioObjectKey("AbC9");

    expect(objectKey).toBe("tts/abc9.wav");
    expect(() => assertValidStorageObjectKey(objectKey)).not.toThrow();
  });

  it("builds converted artifact object keys with stable ids", () => {
    const objectKey = buildConvertedAudioArtifactObjectKey(
      SESSION_ID,
      TURN_ID,
      "Asr_Input",
    );

    expect(objectKey).toBe(`artifacts/${SESSION_ID}/${TURN_ID}/asr_input.wav`);
    expect(() => assertValidStorageObjectKey(objectKey)).not.toThrow();
  });

  it("rejects user-provided filenames and traversal patterns", () => {
    expect(() =>
      assertValidStorageObjectKey("audio/evil/../../secret.webm"),
    ).toThrow();
    expect(() =>
      assertValidStorageObjectKey("uploads/my-recording.webm"),
    ).toThrow();
    expect(() => buildTtsStandardAudioObjectKey("../etc/passwd")).toThrow();
  });
});
