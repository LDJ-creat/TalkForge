import { afterEach, describe, expect, it } from "vitest";

import {
  REQUEST_USER_ID_HEADER,
  resolveClientRequestUserId,
} from "@/shared/request-user";

describe("resolveClientRequestUserId", () => {
  const originalDevUserId = process.env.NEXT_PUBLIC_DEV_USER_ID;

  afterEach(() => {
    if (originalDevUserId === undefined) {
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    } else {
      process.env.NEXT_PUBLIC_DEV_USER_ID = originalDevUserId;
    }
  });

  it("exports the shared request user header name", () => {
    expect(REQUEST_USER_ID_HEADER).toBe("x-talkforge-user-id");
  });

  it("prefers an explicit user id", () => {
    expect(resolveClientRequestUserId(" 44444444-4444-4444-8444-444444444444 ")).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
  });

  it("falls back to NEXT_PUBLIC_DEV_USER_ID", () => {
    process.env.NEXT_PUBLIC_DEV_USER_ID = "55555555-5555-4555-8555-555555555555";
    expect(resolveClientRequestUserId()).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("throws when no user id source is configured", () => {
    delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    expect(() => resolveClientRequestUserId()).toThrow(/user id is required/i);
  });
});
