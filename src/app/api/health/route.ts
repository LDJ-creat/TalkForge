import { checkInfrastructureHealth } from "@/server/infrastructure";
import { getDb } from "@/server/db/client";
import { isHealthDetailAuthorized } from "@/server/observability/health-detail-auth";
import { buildObservabilityStatusReport } from "@/server/observability/status-report";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeDetail = url.searchParams.get("detail") === "1";

  if (!includeDetail) {
    const report = await checkInfrastructureHealth();

    return Response.json(
      {
        ok: report.ok,
        checks: report.checks,
      },
      { status: report.ok ? 200 : 503 },
    );
  }

  if (!isHealthDetailAuthorized(request)) {
    return Response.json(
      {
        error: {
          code: "forbidden",
          message: "Health detail requires authorization.",
        },
      },
      { status: 403 },
    );
  }

  let db: ReturnType<typeof getDb> | undefined;
  try {
    db = getDb();
  } catch {
    db = undefined;
  }

  const report = await buildObservabilityStatusReport({ db });

  return Response.json(report, { status: report.ok ? 200 : 503 });
}
