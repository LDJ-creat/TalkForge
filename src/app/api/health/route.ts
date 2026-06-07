import { checkInfrastructureHealth } from "@/server/infrastructure";

export async function GET() {
  const report = await checkInfrastructureHealth();

  return Response.json(
    {
      ok: report.ok,
      checks: report.checks,
    },
    { status: report.ok ? 200 : 503 },
  );
}
