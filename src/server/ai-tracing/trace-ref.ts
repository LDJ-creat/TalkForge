import type { AiTracingRawStorageBackend } from "@/server/config/types";

const FILE_TRACE_REF_PREFIX = "file:";
const OBJECT_TRACE_REF_PREFIX = "object:";

export function formatRawTraceReference(
  backend: Extract<AiTracingRawStorageBackend, "file" | "object">,
  path: string,
): string {
  const prefix =
    backend === "file" ? FILE_TRACE_REF_PREFIX : OBJECT_TRACE_REF_PREFIX;
  return `${prefix}${path}`;
}

export function parseRawTraceReference(reference: string): {
  backend: "file" | "object";
  path: string;
} | null {
  if (reference.startsWith(FILE_TRACE_REF_PREFIX)) {
    return {
      backend: "file",
      path: reference.slice(FILE_TRACE_REF_PREFIX.length),
    };
  }
  if (reference.startsWith(OBJECT_TRACE_REF_PREFIX)) {
    return {
      backend: "object",
      path: reference.slice(OBJECT_TRACE_REF_PREFIX.length),
    };
  }
  return null;
}
