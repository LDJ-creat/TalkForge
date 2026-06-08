export const END_PRACTICE_SESSION_TOOL_NAME = "end_practice_session";

export const END_PRACTICE_SESSION_REASONS = [
  "goals_complete",
  "user_requested",
  "natural_closing",
] as const;

export type EndPracticeSessionReason = (typeof END_PRACTICE_SESSION_REASONS)[number];

export type QwenOmniFunctionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
};

export const END_PRACTICE_SESSION_TOOL: QwenOmniFunctionTool = {
  type: "function",
  function: {
    name: END_PRACTICE_SESSION_TOOL_NAME,
    description:
      "End the speaking practice session. Call after a brief natural closing when all conversation goals are complete, or immediately when the learner explicitly asks to stop, finish, or end the practice.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: [...END_PRACTICE_SESSION_REASONS],
          description:
            "Why the session is ending: goals_complete when required goals are done; user_requested when the learner asked to stop; natural_closing for a polite wrap-up after goals are met.",
        },
      },
      required: ["reason"],
    },
  },
};

export function parseEndPracticeSessionReason(
  argumentsJson: string | undefined,
): EndPracticeSessionReason | null {
  if (!argumentsJson?.trim()) {
    return "natural_closing";
  }

  try {
    const parsed = JSON.parse(argumentsJson) as { reason?: unknown };
    if (
      typeof parsed.reason === "string" &&
      END_PRACTICE_SESSION_REASONS.includes(parsed.reason as EndPracticeSessionReason)
    ) {
      return parsed.reason as EndPracticeSessionReason;
    }
  } catch {
    return null;
  }

  return null;
}

export function isEndPracticeSessionToolCall(name: string | undefined): boolean {
  return name === END_PRACTICE_SESSION_TOOL_NAME;
}
