export {
  buildAlternativeExpressions,
  buildDeterministicNextPracticeSuggestion,
  buildDeterministicReportSections,
  buildDeterministicSummary,
  buildReportTurnContexts,
  buildShadowingRecommendations,
  computeTaskCompletion,
  resolveScenarioProgress,
  selectKeyCorrections,
  type ReportAggregationInput,
} from "./build-report";
export {
  buildReportJobId,
  REPORT_GENERATING_MARKER,
  REPORT_IN_PROGRESS_WINDOW_MS,
} from "./constants";
export { enqueueSessionReportGeneration } from "./enqueue-session-report";
export { clearStaleReportJob } from "./clear-stale-report-job";
export { ReportServiceError } from "./errors";
export {
  fetchSessionReportForUser,
  type FetchSessionReportDeps,
} from "./fetch-session-report";
export { isReportGenerationComplete } from "./report-status";
export {
  resolveSessionReportAvailability,
  type SessionReportAvailability,
} from "./resolve-report-status";
export {
  listScenarioReportsForUser,
  type ListScenarioReportsDeps,
} from "./list-scenario-reports";
export {
  generateSessionReport,
  type GenerateSessionReportDeps,
  type GenerateSessionReportResult,
} from "./generate-session-report";
export { getLlmReportProvider, resetLlmReportProviderForTests } from "./provider";
export { buildReportPrompt, type ReportPrompt } from "./prompt-builder";
