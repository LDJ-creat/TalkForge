import { createProviderError } from "../errors";
import type { PronunciationEvaluationProvider } from "../pronunciation/contract";
import type {
  PronunciationEvaluateInput,
  PronunciationEvaluationResult,
} from "../pronunciation/types";

export type MockPronunciationEvaluationProviderOptions = {
  name?: string;
  missingObjectKeys?: Set<string>;
  failOnEvaluate?: boolean;
};

export class MockPronunciationEvaluationProvider implements PronunciationEvaluationProvider {
  readonly name: string;
  private readonly missingObjectKeys: Set<string>;
  private readonly failOnEvaluate: boolean;

  constructor(options: MockPronunciationEvaluationProviderOptions = {}) {
    this.name = options.name ?? "mock-pronunciation";
    this.missingObjectKeys = options.missingObjectKeys ?? new Set();
    this.failOnEvaluate = options.failOnEvaluate ?? false;
  }

  async evaluate(input: PronunciationEvaluateInput): Promise<PronunciationEvaluationResult> {
    if (this.failOnEvaluate) {
      throw createProviderError({
        provider: this.name,
        code: "provider_unavailable",
        message: "Mock pronunciation provider is configured to fail.",
      });
    }

    if (this.missingObjectKeys.has(input.audioObjectKey)) {
      throw createProviderError({
        provider: this.name,
        code: "not_found",
        message: `Audio object ${input.audioObjectKey} was not found.`,
      });
    }

    if (input.mode === "shadowing" && !input.referenceText?.trim()) {
      throw createProviderError({
        provider: this.name,
        code: "invalid_request",
        message: "Shadowing evaluation requires referenceText.",
      });
    }

    if (input.mode === "free_speech") {
      return {
        provider: this.name,
        mode: input.mode,
        fluencyScore: 78,
        overallScore: 76,
        details: {
          paceWpm: 118,
          pauseCount: 2,
          fillerWords: 1,
        },
        metadata: {
          audioObjectKey: input.audioObjectKey,
          mock: true,
        },
      };
    }

    return {
      provider: this.name,
      mode: input.mode,
      overallScore: 84,
      accuracyScore: 86,
      completenessScore: 88,
      fluencyScore: 80,
      prosodyScore: 82,
      details: {
        referenceText: input.referenceText,
        mispronouncedWords: [],
      },
      metadata: {
        audioObjectKey: input.audioObjectKey,
        mock: true,
      },
    };
  }
}

export function createMockPronunciationEvaluationProvider(
  options?: MockPronunciationEvaluationProviderOptions,
): MockPronunciationEvaluationProvider {
  return new MockPronunciationEvaluationProvider(options);
}
