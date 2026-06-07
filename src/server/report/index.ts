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
export { ReportServiceError } from "./errors";
export {
  fetchSessionReportForUser,
  type FetchSessionReportDeps,
} from "./fetch-session-report";
export {
  generateSessionReport,
  type GenerateSessionReportDeps,
  type GenerateSessionReportResult,
} from "./generate-session-report";
export { getLlmReportProvider, resetLlmReportProviderForTests } from "./provider";
export { buildReportPrompt, type ReportPrompt } from "./prompt-builder";
