export function redactTraceValue(value: unknown, redactPii: boolean): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactStringValue(value, redactPii);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTraceValue(item, redactPii));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = REDACTED_VALUE;
      continue;
    }

    if (
      redactPii &&
      (key === "email" || key === "phone" || key === "userId" || key === "user_id")
    ) {
      output[key] = REDACTED_VALUE;
      continue;
    }

    if (key === "audio" || key === "audioBytes" || key === "audioData") {
      output[key] = AUDIO_OMITTED_VALUE;
      continue;
    }

    output[key] = redactTraceValue(nestedValue, redactPii);
  }

  return output;
}

export function serializeTracePayload(
  value: unknown,
  redactPii: boolean,
): string {
  return JSON.stringify(redactTraceValue(value, redactPii), null, 2);
}

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|password|token|authorization|access[_-]?key|private[_-]?key)/i;

const REDACTED_VALUE = "[REDACTED]";
const AUDIO_OMITTED_VALUE = "[AUDIO_OMITTED]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactStringValue(value: string, redactPii: boolean): string {
  if (/^Bearer\s+/i.test(value)) {
    return "Bearer [REDACTED]";
  }
  if (/^Basic\s+/i.test(value)) {
    return "Basic [REDACTED]";
  }
  if (!redactPii) {
    return value;
  }
  return value;
}
