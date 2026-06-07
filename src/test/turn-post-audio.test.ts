import { describe, expect, it, vi } from "vitest";

import type { Turn } from "@/domain/turn";
import { createMemoryQueueAdapter } from "@/queue";
import { enqueueTurnPostAudioJobs } from "@/server/turn-post-audio";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const TURN_ID = "22222222-2222-4222-8222-222222222222";
const AUDIO_SEGMENT_ID = "33333333-3333-4333-8333-333333333333";

const userTurn: Turn = {
  id: TURN_ID,
  sessionId: SESSION_ID,
  role: "user",
  transcriptText: "Could I get a medium latte?",
  startedAt: "2026-06-06T00:00:00.000Z",
  endedAt: "2026-06-06T00:00:05.000Z",
  audioSegmentId: AUDIO_SEGMENT_ID,
  evaluationStatus: "pending",
};

describe("enqueueTurnPostAudioJobs", () => {
  it("enqueues correction, pronunciation, and scenario progress jobs when realtime text exists", async () => {
    const adapter = createMemoryQueueAdapter();
    const enqueueSpy = vi.spyOn(adapter, "enqueue");

    const enqueued = await enqueueTurnPostAudioJobs(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
      },
      {
        queueAdapter: adapter,
        getTurnById: async () => userTurn,
      },
    );

    expect(enqueued).toBe(true);
    expect(enqueueSpy).toHaveBeenCalledTimes(3);
    expect(enqueueSpy.mock.calls.map((call) => call[0])).toEqual([
      "correction.analyze",
      "evaluation.freeSpeech",
      "scenarioProgress.evaluate",
    ]);
  });

  it("skips enqueue when the turn has no realtime transcript text", async () => {
    const adapter = createMemoryQueueAdapter();
    const enqueueSpy = vi.spyOn(adapter, "enqueue");

    const enqueued = await enqueueTurnPostAudioJobs(
      {
        turnId: TURN_ID,
        sessionId: SESSION_ID,
        audioSegmentId: AUDIO_SEGMENT_ID,
      },
      {
        queueAdapter: adapter,
        getTurnById: async () => ({
          ...userTurn,
          transcriptText: undefined,
        }),
      },
    );

    expect(enqueued).toBe(false);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});
