type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  return ` ${JSON.stringify(context)}`;
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
