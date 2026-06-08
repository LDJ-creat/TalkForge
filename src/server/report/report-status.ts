import type { Report } from "@/domain/report";

import { REPORT_GENERATING_MARKER } from "./constants";

export function isReportGenerationComplete(report: Report): boolean {
  return report.summary !== REPORT_GENERATING_MARKER;
}
