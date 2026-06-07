export * from "./errors";
export * from "./runtime";
export * from "./types";

export type { RealtimeProvider } from "./realtime/contract";
export type {
  CreateRealtimeSessionInput,
  RealtimeConnectionMode,
  RealtimeSessionCredentials,
  RevokeRealtimeSessionInput,
} from "./realtime/types";

export type { AsrProvider } from "./asr/contract";
export type { AsrTranscribeInput, AsrTranscriptionResult } from "./asr/types";

export type { StorageProvider } from "./storage/contract";
export type {
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  DeleteObjectInput,
  DownloadUrl,
  ObjectExistsInput,
  StorageObjectVisibility,
  StorageUploadMethod,
  UploadTarget,
} from "./storage/types";

export type { TtsProvider } from "./tts/contract";
export {
  buildTtsCacheKey,
  buildTtsObjectKeyFromCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_SPEED,
  DEFAULT_TTS_VOICE,
  hashTtsCacheKey,
} from "./tts/cache-key";
export type { TtsAudioResult, TtsCacheKeyInput, TtsSynthesizeInput } from "./tts/types";

export type { PronunciationEvaluationProvider } from "./pronunciation/contract";
export type {
  PronunciationEvaluateInput,
  PronunciationEvaluationResult,
} from "./pronunciation/types";

export type {
  LlmCorrectionProvider,
  LlmProvider,
  LlmReportProvider,
} from "./llm/contract";
export type {
  CorrectionAnalysisItem,
  CorrectionAnalysisResult,
  CorrectionAnalyzeInput,
  CorrectionContextTurn,
  ReportGenerateInput,
  ReportGenerationResult,
  ReportScenarioContext,
  ReportTurnContext,
} from "./llm/types";

export {
  createMockProviderBundle,
  createMockAsrProvider,
  createMockLlmProvider,
  createMockPronunciationEvaluationProvider,
  createMockRealtimeProvider,
  createMockStorageProvider,
  createMockTtsProvider,
} from "./mock";
export type { MockProviderBundle, MockProviderBundleOptions } from "./mock";

export {
  createOpenAiCompatibleTextLlmProvider,
  buildReportPrompt,
  CORRECTION_PROMPT_VERSION,
  REPORT_PROMPT_VERSION,
  parseCorrectionItemsFromContent,
  parseReportSectionsFromContent,
} from "./openai-compatible-text-llm";

export {
  createDashScopeCosyVoiceTtsProvider,
  DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
  DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
  DASHSCOPE_COSYVOICE_PROVIDER_NAME,
  isSupportedCosyVoiceProviderName,
} from "./dashscope-cosyvoice";

export {
  MockAsrProvider,
  MockLlmProvider,
  MockPronunciationEvaluationProvider,
  MockRealtimeProvider,
  MockStorageProvider,
  MockTtsProvider,
} from "./mock";
