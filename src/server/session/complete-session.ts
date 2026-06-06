import type { Session } from "@/domain/session";
import type { QueueAdapter } from "@/queue/adapter";
import { ReportServiceError } from "@/server/report/errors";
import { enqueueSessionReportGeneration } from "@/server/report/enqueue-session-report";

export type CompleteSessionResult = {
  session: Session;
  reportJobEnqueued: boolean;
};

export type CompleteSessionDeps = {
  getSessionById: (sessionId: string) => Promise<Session | null>;
  completeSession: (sessionId: string, endedAt?: string) => Promise<Session | null>;
  enqueueReportGeneration?: (
    sessionId: string,
  ) => Promise<unknown>;
};

export async function completeSessionForUser(
  sessionId: string,
  userId: string,
  deps: CompleteSessionDeps,
  options: { endedAt?: string } = {},
): Promise<CompleteSessionResult> {
  const session = await deps.getSessionById(sessionId);
  if (!session) {
    throw new ReportServiceError(404, "session_not_found", "Session was not found.");
  }

  if (session.userId !== userId) {
    throw new ReportServiceError(403, "forbidden", "You do not have access to this session.");
  }

  const completed =
    session.status === "completed"
      ? session
      : await deps.completeSession(sessionId, options.endedAt);

  if (!completed || completed.status !== "completed") {
    throw new ReportServiceError(
      409,
      "session_not_completable",
      "Session could not be marked as completed.",
    );
  }

  let reportJobEnqueued = false;
  if (deps.enqueueReportGeneration) {
    await deps.enqueueReportGeneration(sessionId);
    reportJobEnqueued = true;
  }

  return {
    session: completed,
    reportJobEnqueued,
  };
}

export type CompleteSessionWithQueueOptions = {
  endedAt?: string;
  queueAdapter?: QueueAdapter;
};

export function createCompleteSessionDeps(
  getSessionById: CompleteSessionDeps["getSessionById"],
  completeSession: CompleteSessionDeps["completeSession"],
  queueAdapter?: QueueAdapter,
): CompleteSessionDeps {
  return {
    getSessionById,
    completeSession,
    enqueueReportGeneration: queueAdapter
      ? (sessionId) => enqueueSessionReportGeneration(queueAdapter, sessionId)
      : undefined,
  };
}
