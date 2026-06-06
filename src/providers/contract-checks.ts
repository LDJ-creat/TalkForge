import type { AsrProvider } from "./asr/contract";
import type { LlmCorrectionProvider, LlmReportProvider } from "./llm/contract";
import type { PronunciationEvaluationProvider } from "./pronunciation/contract";
import type { RealtimeProvider } from "./realtime/contract";
import type { StorageProvider } from "./storage/contract";
import type { TtsProvider } from "./tts/contract";
import { createMockProviderBundle } from "./mock";

const mockProviders = createMockProviderBundle();

const _realtimeContractCheck: RealtimeProvider = mockProviders.realtime;
const _asrContractCheck: AsrProvider = mockProviders.asr;
const _storageContractCheck: StorageProvider = mockProviders.storage;
const _ttsContractCheck: TtsProvider = mockProviders.tts;
const _pronunciationContractCheck: PronunciationEvaluationProvider =
  mockProviders.pronunciation;
const _llmCorrectionContractCheck: LlmCorrectionProvider = mockProviders.llmCorrection;
const _llmReportContractCheck: LlmReportProvider = mockProviders.llmReport;

void _realtimeContractCheck;
void _asrContractCheck;
void _storageContractCheck;
void _ttsContractCheck;
void _pronunciationContractCheck;
void _llmCorrectionContractCheck;
void _llmReportContractCheck;
