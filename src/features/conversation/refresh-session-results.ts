import { completeSessionOnServer } from "./complete-session-api";
import { pollSessionReportFromServer } from "./fetch-report-api";
import { pollSessionShadowingFromServer } from "./fetch-shadowing-api";

export async function refreshSessionReportAndShadowing(sessionId: string) {
  await completeSessionOnServer(sessionId);
  const report = await pollSessionReportFromServer(sessionId);
  const shadowingItems = report ? await pollSessionShadowingFromServer(sessionId) : [];

  return { report, shadowingItems };
}
