import { notFound } from "next/navigation";

import { ScenarioPracticeShell } from "@/components/scenario-practice-shell";
import { getDb } from "@/server/db/client";
import { resolveScenario } from "@/server/scenario/catalog";

type PracticePageProps = {
  params: Promise<{ scenarioId: string }>;
};

export const dynamic = "force-dynamic";

export default async function PracticePage({ params }: PracticePageProps) {
  const { scenarioId } = await params;
  const db = getDb();
  const scenario = await resolveScenario(db, scenarioId);

  if (!scenario) {
    notFound();
  }

  return <ScenarioPracticeShell scenario={scenario} />;
}
