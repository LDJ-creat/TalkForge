/** Persisted while report content is being generated. */
export const REPORT_GENERATING_MARKER = "__talkforge_report_generating__";

/** Recent placeholders are treated as in-progress work owned by another worker. */
export const REPORT_IN_PROGRESS_WINDOW_MS = 5 * 60 * 1000;

export function buildReportJobId(sessionId: string): string {
  return `report:${sessionId}`;
}
