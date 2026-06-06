import { notFound } from "next/navigation";

import { ConversationShell } from "@/components/conversation-shell";
import { getSeedScenarioById } from "@/server/scenario/catalog";

type PracticePageProps = {
  params: Promise<{ scenarioId: string }>;
};

export default async function PracticePage({ params }: PracticePageProps) {
  const { scenarioId } = await params;
  const scenario = getSeedScenarioById(scenarioId);

  if (!scenario) {
    notFound();
  }

  return <ConversationShell scenario={scenario} />;
}

export async function generateStaticParams() {
  const { listSeedScenarios } = await import("@/server/scenario/catalog");
  return listSeedScenarios().map((scenario) => ({
    scenarioId: scenario.id,
  }));
}
