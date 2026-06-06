import { describe, expect, it } from "vitest";

import {
  isJobProcessingError,
  JobProcessingError,
  normalizeJobError,
  shouldRetryJobFailure,
} from "@/queue";

describe("job error normalization", () => {
  it("preserves JobProcessingError metadata", () => {
    const error = new JobProcessingError({
      code: "processing",
      message: "Mock worker failed.",
      attempts: 2,
      retryable: true,
    });

    expect(isJobProcessingError(error)).toBe(true);
    expect(normalizeJobError(error, { attempts: 2 }).code).toBe("processing");
  });

  it("maps generic Error messages to normalized job codes", () => {
    const normalized = normalizeJobError(new Error("Request timed out"), {
      attempts: 1,
    });

    expect(normalized.code).toBe("timeout");
    expect(normalized.retryable).toBe(true);
  });

  it("retries generic failures like BullMQ unless explicitly disabled", () => {
    expect(shouldRetryJobFailure(new Error("temporary"), 1, 3)).toBe(true);
    expect(
      shouldRetryJobFailure(
        new JobProcessingError({
          code: "validation",
          message: "Invalid payload.",
          attempts: 1,
          retryable: false,
        }),
        1,
        3,
      ),
    ).toBe(false);
  });
});
