import type { ProviderErrorCode } from "@/providers/errors";

import {
  classifyProviderErrorCode,
  classifySessionServiceErrorCode,
  type OperationalErrorCategory,
} from "./error-categories";

type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  return ` ${JSON.stringify(context)}`;
}

export type { ProviderCallLogInput } from "@/providers/runtime";
export { logProviderCall } from "@/providers/runtime";

export function resolveOperationalErrorCategory(input: {
  providerErrorCode?: ProviderErrorCode | string;
  serviceErrorCode?: string;
}): OperationalErrorCategory {
  if (input.serviceErrorCode) {
    const sessionCategory = classifySessionServiceErrorCode(input.serviceErrorCode);
    if (sessionCategory !== "internal") {
      return sessionCategory;
    }
  }

  return classifyProviderErrorCode(input.providerErrorCode);
}

export function logOperationalAlert(
  event: string,
  context: LogContext & { category: OperationalErrorCategory },
): void {
  console.warn(`[talkforge:ops] ${event}${formatContext(context)}`);
}

export function logSessionLifecycle(
  event: string,
  context: LogContext & { sessionId: string },
): void {
  console.info(`[talkforge:session] ${event}${formatContext(context)}`);
}

export function logJobLifecycle(
  event: string,
  context: LogContext & { jobName: string; jobId?: string },
): void {
  console.info(`[talkforge:job] ${event}${formatContext(context)}`);
}

export function logTurnLifecycle(
  event: string,
  context: LogContext & { sessionId: string; turnId: string },
): void {
  console.info(`[talkforge:turn] ${event}${formatContext(context)}`);
}
