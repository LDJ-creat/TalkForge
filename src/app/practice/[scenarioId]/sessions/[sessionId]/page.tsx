import { notFound } from "next/navigation";

import { SessionAnalysisDetail } from "@/components/session-analysis-detail";
import { getDb } from "@/server/db/client";
import { resolveScenario } from "@/server/scenario/catalog";

type SessionAnalysisPageProps = {
  params: Promise<{ scenarioId: string; sessionId: string }>;
};

export const dynamic = "force-dynamic";

export default async function SessionAnalysisPage({ params }: SessionAnalysisPageProps) {
  const { scenarioId, sessionId } = await params;
  const db = getDb();
  const scenario = await resolveScenario(db, scenarioId);

  if (!scenario) {
    notFound();
  }

  return <SessionAnalysisDetail scenario={scenario} sessionId={sessionId} />;
}
