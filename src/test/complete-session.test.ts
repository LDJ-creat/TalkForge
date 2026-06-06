import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/domain/session";
import { POST as completeSessionRoute } from "@/app/api/sessions/[sessionId]/complete/route";
import { createMemoryQueueAdapter } from "@/queue";
import { REQUEST_USER_ID_HEADER } from "@/server/api/http";
import { buildReportJobId } from "@/server/report/constants";
import {
  completeSessionForUser,
  createCompleteSessionDeps,
} from "@/server/session";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "99999999-9999-4999-8999-999999999999";

const activeSession: Session = {
  id: SESSION_ID,
  userId: USER_ID,
  scenarioId: "coffee_ordering_a2",
  realtimeProvider: "mock-realtime",
  status: "active",
  startedAt: "2026-06-06T00:00:00.000Z",
};

const getSessionById = vi.fn();
const completeSession = vi.fn();
const getQueueAdapter = vi.fn();

vi.mock("@/server/db/client", () => ({
  getDb: () => ({}),
}));

vi.mock("@/server/db/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/repositories")>();
  return {
    ...actual,
    getSessionById: (...args: unknown[]) => getSessionById(...args),
    completeSession: (...args: unknown[]) => completeSession(...args),
  };
});

vi.mock("@/server/queue/provider", () => ({
  getQueueAdapter: () => getQueueAdapter(),
}));

describe("complete session service", () => {
  it("marks the session completed and enqueues report generation", async () => {
    const adapter = createMemoryQueueAdapter();

    const result = await completeSessionForUser(
      SESSION_ID,
      USER_ID,
      createCompleteSessionDeps(
        async () => activeSession,
        async () => ({
          ...activeSession,
          status: "completed",
          endedAt: "2026-06-06T00:10:00.000Z",
        }),
        adapter,
      ),
    );

    expect(result.session.status).toBe("completed");
    expect(result.reportJobEnqueued).toBe(true);

    const job = await adapter.getJob(buildReportJobId(SESSION_ID));
    expect(job?.name).toBe("report.generate");
    expect(job?.payload).toEqual({ sessionId: SESSION_ID });
  });

  it("is idempotent for already completed sessions", async () => {
    const enqueue = vi.fn();
    const completedSession: Session = {
      ...activeSession,
      status: "completed",
      endedAt: "2026-06-06T00:10:00.000Z",
    };

    const result = await completeSessionForUser(
      SESSION_ID,
      USER_ID,
      {
        getSessionById: async () => completedSession,
        completeSession: async () => {
          throw new Error("completeSession should not be called");
        },
        enqueueReportGeneration: enqueue,
      },
    );

    expect(result.session.status).toBe("completed");
    expect(result.reportJobEnqueued).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(SESSION_ID);
  });
});

describe("complete session API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a request user header", async () => {
    const response = await completeSessionRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/complete`, {
        method: "POST",
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(401);
  });

  it("completes a session and enqueues report generation", async () => {
    getSessionById.mockResolvedValue(activeSession);
    completeSession.mockResolvedValue({
      ...activeSession,
      status: "completed",
      endedAt: "2026-06-06T00:10:00.000Z",
    });

    const adapter = createMemoryQueueAdapter();
    getQueueAdapter.mockReturnValue(adapter);

    const response = await completeSessionRoute(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/complete`, {
        method: "POST",
        headers: {
          [REQUEST_USER_ID_HEADER]: USER_ID,
        },
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.session.status).toBe("completed");
    expect(body.reportJobEnqueued).toBe(true);

    const job = await adapter.getJob(buildReportJobId(SESSION_ID));
    expect(job?.name).toBe("report.generate");
  });
});
