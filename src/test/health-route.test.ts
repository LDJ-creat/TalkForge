import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

vi.mock("@/server/infrastructure", () => ({
  checkInfrastructureHealth: vi.fn(async () => ({
    ok: true,
    checks: {
      postgres: { ok: true, latencyMs: 1 },
      redis: { ok: true, skipped: true },
      ffmpeg: { ok: true, skipped: true },
    },
  })),
}));

vi.mock("@/server/db/client", () => ({
  getDb: () => {
    throw new Error("database unavailable in test");
  },
}));

describe("GET /api/health", () => {
  it("returns 200 when infrastructure is healthy", async () => {
    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.postgres.ok).toBe(true);
  });
});
