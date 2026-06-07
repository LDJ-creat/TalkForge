export {
  buildDashScopeInferenceWebSocketUrl,
  DEFAULT_DASHSCOPE_API_BASE_URL,
  DEFAULT_DASHSCOPE_PARAFORMER_MODEL,
  DASHSCOPE_PARAFORMER_PROVIDER_NAME,
  PARAFORMER_8K_SAMPLE_RATE,
  PARAFORMER_PCM_CHUNK_BYTES,
  type DashScopeParaformerProviderConfig,
} from "./config";

export { normalizeDashScopeParaformerResponse } from "./normalize";
export {
  createDashScopeParaformerAsrProvider,
  DashScopeParaformerAsrProvider,
  type CreateDashScopeParaformerAsrProviderOptions,
  type LoadedAudioObject,
  type LoadAudioObjectInput,
} from "./asr-provider";
export {
  transcribeDashScopeParaformerAudio,
  type TranscribeDashScopeParaformerAudioInput,
} from "./websocket-client";
export type {
  DashScopeParaformerResultGeneratedEvent,
  DashScopeParaformerSentence,
  DashScopeParaformerServerEvent,
  DashScopeParaformerTranscriptionResult,
  DashScopeParaformerWord,
} from "./types";
