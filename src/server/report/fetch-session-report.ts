import type { Report } from "@/domain/report";
import type { Session } from "@/domain/session";

import { ReportServiceError } from "./errors";

export type FetchSessionReportDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  getReportBySessionId: (sessionId: string) => Promise<Report | null>;
};

export async function fetchSessionReportForUser(
  sessionId: string,
  userId: string,
  deps: FetchSessionReportDeps,
): Promise<Report> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new ReportServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new ReportServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const report = await deps.getReportBySessionId(sessionId);
  if (!report) {
    throw new ReportServiceError(404, "report_not_found", "Report was not found for this session.");
  }

  return report;
}
