import type { AsrProvider } from "../asr/contract";
import type { LlmCorrectionProvider, LlmReportProvider } from "../llm/contract";
import type { PronunciationEvaluationProvider } from "../pronunciation/contract";
import type { RealtimeProvider } from "../realtime/contract";
import type { StorageProvider } from "../storage/contract";
import type { TtsProvider } from "../tts/contract";
import { createMockAsrProvider, type MockAsrProviderOptions } from "./asr";
import { createMockLlmProvider, type MockLlmProviderOptions } from "./llm";
import {
  createMockPronunciationEvaluationProvider,
  type MockPronunciationEvaluationProviderOptions,
} from "./pronunciation";
import { createMockRealtimeProvider, type MockRealtimeProviderOptions } from "./realtime";
import { createMockStorageProvider, type MockStorageProviderOptions } from "./storage";
import { createMockTtsProvider, type MockTtsProviderOptions } from "./tts";

export type MockProviderBundleOptions = {
  realtime?: MockRealtimeProviderOptions;
  asr?: MockAsrProviderOptions;
  storage?: MockStorageProviderOptions;
  tts?: MockTtsProviderOptions;
  pronunciation?: MockPronunciationEvaluationProviderOptions;
  llm?: MockLlmProviderOptions;
};

export type MockProviderBundle = {
  realtime: RealtimeProvider;
  asr: AsrProvider;
  storage: StorageProvider;
  tts: TtsProvider;
  pronunciation: PronunciationEvaluationProvider;
  llmCorrection: LlmCorrectionProvider;
  llmReport: LlmReportProvider;
};

export function createMockProviderBundle(
  options: MockProviderBundleOptions = {},
): MockProviderBundle {
  const llm = createMockLlmProvider(options.llm);

  return {
    realtime: createMockRealtimeProvider(options.realtime),
    asr: createMockAsrProvider(options.asr),
    storage: createMockStorageProvider(options.storage),
    tts: createMockTtsProvider(options.tts),
    pronunciation: createMockPronunciationEvaluationProvider(options.pronunciation),
    llmCorrection: llm,
    llmReport: llm,
  };
}

export {
  createMockAsrProvider,
  createMockLlmProvider,
  createMockPronunciationEvaluationProvider,
  createMockRealtimeProvider,
  createMockStorageProvider,
  createMockTtsProvider,
};

export type {
  MockAsrProviderOptions,
  MockLlmProviderOptions,
  MockPronunciationEvaluationProviderOptions,
  MockRealtimeProviderOptions,
  MockStorageProviderOptions,
  MockTtsProviderOptions,
};

export { MockAsrProvider } from "./asr";
export { MockLlmProvider } from "./llm";
export { MockPronunciationEvaluationProvider } from "./pronunciation";
export { MockRealtimeProvider } from "./realtime";
export { MockStorageProvider } from "./storage";
export { MockTtsProvider } from "./tts";
