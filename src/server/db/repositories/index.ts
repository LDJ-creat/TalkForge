export {
  completeSession,
  createSession,
  getScenarioById,
  getSessionById,
  listScenarios,
  upsertScenario,
} from "./scenario-session-repository";
export { getScenarioProgressBySessionId } from "./scenario-progress-repository";
export {
  finalizeReport,
  getReportBySessionId,
  isReportGenerationComplete,
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
  prepareFreeSpeechEvaluation,
  saveFreeSpeechEvaluationForTurnIfAbsent,
  saveShadowingEvaluationForTurnIfAbsent,
} from "./pronunciation-evaluation-repository";
export type {
  PrepareFreeSpeechEvaluationResult,
  SavePronunciationEvaluationResult,
} from "./pronunciation-evaluation-repository";
