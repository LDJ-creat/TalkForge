type AiTracingLogContext = Record<string, unknown>;

function formatContext(context?: AiTracingLogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  return ` ${JSON.stringify(context)}`;
}

export function logAiTracingWarning(
  event: string,
  context: AiTracingLogContext,
): void {
  console.warn(`[talkforge:ai-tracing] ${event}${formatContext(context)}`);
}
