export type AiTraceArtifactKind = "request" | "response";

export function buildAiTraceObjectKey(
  logId: string,
  kind: AiTraceArtifactKind,
): string {
  return `ai-traces/${logId}/${kind}.json`;
}

export function buildAiTraceLocalRelativePath(
  logId: string,
  kind: AiTraceArtifactKind,
): string {
  return `${logId}/${kind}.json`;
}

export const AI_TRACE_OBJECT_KEY_PATTERN =
  /^ai-traces\/[0-9a-f-]{36}\/(request|response)\.json$/i;
