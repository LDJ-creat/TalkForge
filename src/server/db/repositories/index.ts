export {
  completeSession,
  createSession,
  failSession,
  getScenarioById,
  getSessionById,
  listScenarios,
  updateSessionRealtimeProviderSessionId,
  upsertScenario,
} from "./scenario-session-repository";
export { ensureUserExists, getUserById } from "./user-repository";
export {
  createInitialScenarioProgressForSession,
  getScenarioProgressBySessionId,
  upsertScenarioProgress,
} from "./scenario-progress-repository";
export {
  finalizeReport,
  getReportBySessionId,
  isReportGenerationComplete,
  listCompletedReportsByScenarioForUser,
  prepareReportGeneration,
  saveReportForSessionIfAbsent,
} from "./report-repository";
export type {
  PrepareReportGenerationResult,
  SaveReportForSessionResult,
} from "./report-repository";
export {
  createAudioSegment,
  deleteAudioSegment,
  getAudioSegmentById,
} from "./audio-segment-repository";
export {
  clearTurnAudioSegment,
  createTurn,
  getTurnById,
  linkTurnAudioSegment,
  listTurnsBySessionId,
  updateTurnEvaluationStatus,
  updateTurnTranscriptText,
} from "./turn-repository";
export {
  createTranscript,
  getTranscriptById,
  getTranscriptByTurnId,
  getTranscriptsByTurnIds,
  saveTranscriptForTurn,
} from "./transcript-repository";
export {
  createCorrection,
  createCorrections,
  deleteCorrectionsByTurnId,
  getCorrectionsByTurnId,
  getCorrectionsByTurnIds,
  saveCorrectionsForTurnIfAbsent,
} from "./correction-repository";
export {
  getFreeSpeechEvaluationsByTurnIds,
  getPronunciationEvaluationByTurnIdAndMode,
  markTurnEvaluationFailed,
  markTurnEvaluationSkipped,
  prepareFreeSpeechEvaluation,
  prepareShadowingEvaluation,
  saveFreeSpeechEvaluationForTurnIfAbsent,
  saveShadowingEvaluationForTurnIfAbsent,
} from "./pronunciation-evaluation-repository";
export type {
  PrepareFreeSpeechEvaluationResult,
  PrepareShadowingEvaluationResult,
  SavePronunciationEvaluationResult,
} from "./pronunciation-evaluation-repository";
export {
  countAiInvocationLogs,
  createAiInvocationLog,
  getAiInvocationLogById,
  listAiInvocationLogsBySessionId,
} from "./ai-invocation-log-repository";
export {
  aggregateAiInvocationMetrics,
  countAiInvocationLogsBySessionAndOperation,
  countAsrTranscribeAttemptsForSession,
  countReportGenerationAttemptsForSession,
  listAiInvocationProviderBreakdown,
} from "./ai-invocation-metrics-repository";
export type {
  AiInvocationAggregateMetrics,
  AiInvocationProviderBreakdown,
} from "./ai-invocation-metrics-repository";
export {
  createDbStandardAudioMetadataRepository,
  findStandardAudioAssetByCacheKey,
  upsertStandardAudioAsset,
} from "./standard-audio-asset-repository";
export {
  listShadowingItemsBySessionId,
  prepareShadowingGeneration,
  replaceShadowingItemsForSession,
  updateShadowingItemStandardAudio,
} from "./shadowing-item-repository";
export type {
  CreateShadowingItemRecordInput,
  PrepareShadowingGenerationResult,
  ReplaceShadowingItemsForSessionInput,
} from "./shadowing-item-repository";
