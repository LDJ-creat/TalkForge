export {
  createDashScopeCosyVoiceTtsProvider,
  DashScopeCosyVoiceTtsProvider,
  type CreateDashScopeCosyVoiceTtsProviderOptions,
  type PersistStandardAudioObjectInput,
  type StandardAudioMetadataRepository,
} from "./tts-provider";
export {
  DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
  DEFAULT_DASHSCOPE_COSYVOICE_SAMPLE_RATE,
  DEFAULT_DASHSCOPE_COSYVOICE_VOICE,
  DEFAULT_DASHSCOPE_TTS_API_BASE_URL,
  DASHSCOPE_COSYVOICE_PROVIDER_NAME,
  isSupportedCosyVoiceProviderName,
} from "./config";
export {
  synthesizeDashScopeCosyVoiceAudio,
  type DashScopeCosyVoiceSynthesisInput,
  type DashScopeCosyVoiceSynthesisResult,
} from "./http-client";
