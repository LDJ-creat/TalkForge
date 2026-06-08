import type { Report } from "@/domain/report";

import { REPORT_IN_PROGRESS_WINDOW_MS } from "./constants";
import { isReportGenerationComplete } from "./report-status";

export type SessionReportAvailability =
  | { status: "ready"; report: Report }
  | { status: "generating"; report: Report }
  | { status: "failed"; report: Report }
  | { status: "missing" };

export function resolveSessionReportAvailability(
  report: Report | null,
  options: { now?: () => Date } = {},
): SessionReportAvailability {
  if (!report) {
    return { status: "missing" };
  }

  if (isReportGenerationComplete(report)) {
    return { status: "ready", report };
  }

  const now = options.now ?? (() => new Date());
  const ageMs = now().getTime() - new Date(report.createdAt).getTime();

  if (ageMs < REPORT_IN_PROGRESS_WINDOW_MS) {
    return { status: "generating", report };
  }

  return { status: "failed", report };
}
