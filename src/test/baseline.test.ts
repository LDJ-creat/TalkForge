import { describe, expect, it } from "vitest";

import { APP_NAME, APP_TAGLINE, getAppShellDescription } from "@/lib/app-info";

describe("app-info", () => {
  it("exposes TalkForge shell metadata", () => {
    expect(APP_NAME).toBe("TalkForge");
    expect(APP_TAGLINE).toContain("英语口语");
    expect(getAppShellDescription()).toContain(APP_NAME);
  });
});
