import { completeSessionOnServer } from "./complete-session-api";
import { pollSessionReportFromServer } from "./fetch-report-api";

const REPORT_RETRY_POLL_ATTEMPTS = 240;
const REPORT_RETRY_POLL_INTERVAL_MS = 1500;

export async function retrySessionReportFromServer(sessionId: string, userId?: string) {
  await completeSessionOnServer(sessionId, userId);
  return pollSessionReportFromServer(sessionId, {
    attempts: REPORT_RETRY_POLL_ATTEMPTS,
    intervalMs: REPORT_RETRY_POLL_INTERVAL_MS,
    isRetry: true,
  });
}
