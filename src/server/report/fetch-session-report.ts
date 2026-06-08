import type { Report } from "@/domain/report";
import type { Session } from "@/domain/session";

import { ReportServiceError } from "./errors";
import { resolveSessionReportAvailability } from "./resolve-report-status";

export type FetchSessionReportDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  findReportBySessionId: (sessionId: string) => Promise<Report | null>;
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

  const report = await deps.findReportBySessionId(sessionId);
  const availability = resolveSessionReportAvailability(report);

  switch (availability.status) {
    case "ready":
      return availability.report;
    case "missing":
      throw new ReportServiceError(
        404,
        "report_not_found",
        "Report was not found for this session.",
      );
    case "generating":
      throw new ReportServiceError(
        202,
        "report_generating",
        "Report is still being generated.",
      );
    case "failed":
      throw new ReportServiceError(
        503,
        "report_generation_failed",
        "Report generation failed. Retry report generation from the practice history panel.",
      );
  }
}
