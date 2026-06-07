import { completeSessionOnServer } from "./complete-session-api";
import { pollSessionReportFromServer } from "./fetch-report-api";
import { pollSessionShadowingFromServer } from "./fetch-shadowing-api";

/** Match SCENARIO_GENERATE_TIMEOUT_MS (300s) plus queue/evaluation lead time. */
const REPORT_POLL_ATTEMPTS = 240;
const REPORT_POLL_INTERVAL_MS = 1500;

export async function refreshSessionReportAndShadowing(sessionId: string) {
  await completeSessionOnServer(sessionId);
  const report = await pollSessionReportFromServer(sessionId, {
    attempts: REPORT_POLL_ATTEMPTS,
    intervalMs: REPORT_POLL_INTERVAL_MS,
  });
  const shadowingItems = report
    ? await pollSessionShadowingFromServer(sessionId, {
        attempts: REPORT_POLL_ATTEMPTS,
        intervalMs: REPORT_POLL_INTERVAL_MS,
      })
    : [];

  return { report, shadowingItems };
}
