import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import { findReportRowBySessionId, getSessionById } from "@/server/db/repositories";
import { fetchSessionReportForUser } from "@/server/report/fetch-session-report";
import { ReportServiceError } from "@/server/report/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { sessionId } = await context.params;

    const report = await fetchSessionReportForUser(sessionId, userId, {
      getSessionById: (id) => getSessionById(getDb(), id),
      findReportBySessionId: (id) => findReportRowBySessionId(getDb(), id),
    });

    return Response.json({ report });
  } catch (error) {
    if (error instanceof ReportServiceError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}
