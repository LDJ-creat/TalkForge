import { describe, expect, it } from "vitest";

import {
  END_PRACTICE_SESSION_TOOL,
  END_PRACTICE_SESSION_TOOL_NAME,
  isEndPracticeSessionToolCall,
  parseEndPracticeSessionReason,
} from "@/providers/qwen-omni/end-practice-session-tool";

describe("end practice session tool", () => {
  it("defines the end_practice_session tool for session.update", () => {
    expect(END_PRACTICE_SESSION_TOOL.type).toBe("function");
    expect(END_PRACTICE_SESSION_TOOL.function.name).toBe(END_PRACTICE_SESSION_TOOL_NAME);
    expect(END_PRACTICE_SESSION_TOOL.function.parameters.required).toContain("reason");
  });

  it("parses valid end reasons from function call arguments", () => {
    expect(parseEndPracticeSessionReason('{"reason":"user_requested"}')).toBe("user_requested");
    expect(parseEndPracticeSessionReason('{"reason":"goals_complete"}')).toBe("goals_complete");
  });

  it("falls back when arguments are missing or invalid", () => {
    expect(parseEndPracticeSessionReason(undefined)).toBe("natural_closing");
    expect(parseEndPracticeSessionReason("{not-json")).toBeNull();
    expect(parseEndPracticeSessionReason('{"reason":"unknown"}')).toBeNull();
  });

  it("recognizes the configured tool name", () => {
    expect(isEndPracticeSessionToolCall(END_PRACTICE_SESSION_TOOL_NAME)).toBe(true);
    expect(isEndPracticeSessionToolCall("other_tool")).toBe(false);
  });
});
