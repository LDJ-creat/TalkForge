import { describe, expect, it } from "vitest";

import { mergeTranscriptsWithServerTurns } from "@/features/conversation/sync-transcripts";
import type { TranscriptEntry } from "@/features/conversation/types";

const opening: TranscriptEntry = {
  id: "opening",
  role: "assistant",
  text: "Welcome!",
  status: "final",
  timestamp: "2026-06-06T00:00:00.000Z",
};

describe("mergeTranscriptsWithServerTurns", () => {
  it("replaces optimistic turns with server transcripts while keeping the opening line", () => {
    const merged = mergeTranscriptsWithServerTurns(
      [
        opening,
        {
          id: "temp-user",
          role: "user",
          text: "Could I get a medium latte?",
          status: "final",
          timestamp: "2026-06-06T00:00:10.000Z",
        },
      ],
      [
        {
          id: "turn-user",
          role: "user",
          transcriptText: "Mock transcript for audio/sessions/turn-user.webm",
          startedAt: "2026-06-06T00:00:10.000Z",
        },
        {
          id: "turn-assistant",
          role: "assistant",
          transcriptText: "Sure! Would you like that hot or iced?",
          startedAt: "2026-06-06T00:00:12.000Z",
        },
      ],
    );

    expect(merged).toHaveLength(3);
    expect(merged[0]?.id).toBe("opening");
    expect(merged[1]?.text).toContain("Mock transcript");
    expect(merged[2]?.role).toBe("assistant");
  });

  it("returns existing transcripts when server turns have no text yet", () => {
    const existing = [opening];
    expect(
      mergeTranscriptsWithServerTurns(existing, [
        {
          id: "turn-user",
          role: "user",
          startedAt: "2026-06-06T00:00:10.000Z",
        },
      ]),
    ).toEqual(existing);
  });
});
