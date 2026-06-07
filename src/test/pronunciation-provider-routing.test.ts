import { afterEach, describe, expect, it } from "vitest";

import {
  getFreeSpeechPronunciationProvider,
  getShadowingPronunciationProvider,
  resetPronunciationProviderForTests,
} from "@/server/pronunciation/provider";
import { resetRuntimeConfigForTests } from "@/server/config";

describe("pronunciation provider routing", () => {
  afterEach(() => {
    resetRuntimeConfigForTests();
    resetPronunciationProviderForTests();
    delete process.env.PRONUNCIATION_PROVIDER;
    delete process.env.PRONUNCIATION_API_KEY;
    delete process.env.PRONUNCIATION_API_SECRET;
    delete process.env.PRONUNCIATION_APP_ID;
  });

  it("keeps free speech on mock scoring when iflytek-ise is configured", () => {
    resetRuntimeConfigForTests();
    resetPronunciationProviderForTests();
    process.env.PRONUNCIATION_PROVIDER = "iflytek-ise";
    process.env.PRONUNCIATION_API_KEY = "key-test";
    process.env.PRONUNCIATION_API_SECRET = "secret-test";
    process.env.PRONUNCIATION_APP_ID = "app-test";

    expect(getFreeSpeechPronunciationProvider().name).toBe("mock-pronunciation");
    expect(getShadowingPronunciationProvider().name).toBe("iflytek-ise-pronunciation");
  });
});
