import { jsonError, requireRequestUserId } from "@/server/api/http";
import { getDb } from "@/server/db/client";
import {
  getScenarioById,
  listCompletedReportsByScenarioForUser,
} from "@/server/db/repositories";
import { ReportServiceError } from "@/server/report/errors";
import { listScenarioReportsForUser } from "@/server/report/list-scenario-reports";

export async function GET(
  request: Request,
  context: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const userId = requireRequestUserId(request);
    const { scenarioId } = await context.params;
    const db = getDb();

    const result = await listScenarioReportsForUser(scenarioId, userId, {
      getScenarioById: (id) => getScenarioById(db, id),
      listCompletedReportsByScenarioForUser: (ownerId, id) =>
        listCompletedReportsByScenarioForUser(db, ownerId, id),
    });

    return Response.json(result);
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
