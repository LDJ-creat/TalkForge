import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

vi.mock("@/server/infrastructure", () => ({
  checkInfrastructureHealth: vi.fn(async () => ({
    ok: true,
    checks: {
      postgres: { ok: true, latencyMs: 1 },
      redis: { ok: true, skipped: true },
    },
  })),
}));

describe("GET /api/health", () => {
  it("returns 200 when infrastructure is healthy", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.postgres.ok).toBe(true);
  });
});
