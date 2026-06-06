import { describe, expect, it } from "vitest";

import {
  createProviderError,
  isProviderError,
  normalizeProviderError,
  ProviderError,
} from "@/providers/errors";

describe("provider error normalization", () => {
  it("preserves existing ProviderError instances", () => {
    const error = createProviderError({
      provider: "mock-asr",
      code: "not_found",
      message: "Audio object missing.",
    });

    expect(normalizeProviderError(error, { provider: "mock-asr" })).toBe(error);
    expect(isProviderError(error)).toBe(true);
  });

  it("maps generic Error messages to normalized provider codes", () => {
    const normalized = normalizeProviderError(new Error("Request timed out"), {
      provider: "mock-storage",
    });

    expect(normalized).toBeInstanceOf(ProviderError);
    expect(normalized.code).toBe("timeout");
    expect(normalized.provider).toBe("mock-storage");
    expect(normalized.retryable).toBe(true);
  });

  it("falls back to internal for unknown thrown values", () => {
    const normalized = normalizeProviderError("unexpected", {
      provider: "mock-llm",
      defaultCode: "internal",
    });

    expect(normalized.code).toBe("internal");
    expect(normalized.message).toBe("Provider request failed.");
    expect(normalized.retryable).toBe(false);
  });

  it("marks authentication failures as non-retryable by default", () => {
    const normalized = normalizeProviderError(new Error("Authentication failed"), {
      provider: "mock-realtime",
    });

    expect(normalized.code).toBe("authentication");
    expect(normalized.retryable).toBe(false);
  });
});
