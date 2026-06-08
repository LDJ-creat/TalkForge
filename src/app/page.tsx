import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { homeCopy } from "@/lib/ui-copy";
import { getDb } from "@/server/db/client";
import { listAllScenarios } from "@/server/scenario/catalog";

import { ScenarioPicker } from "@/components/scenario-picker";
import { CefrLevelGuide } from "@/components/cefr-level-guide";

export default async function HomePage() {
  const db = getDb();
  const scenarios = await listAllScenarios(db);

  return (
    <main className="scenario-page">
      <header className="scenario-page__header">
        <p className="scenario-page__eyebrow">{APP_NAME}</p>
        <h1 className="scenario-page__title">{homeCopy.title}</h1>
        <p className="scenario-page__subtitle">
          {APP_TAGLINE}。{homeCopy.subtitle}
        </p>
      </header>
      <CefrLevelGuide variant="compact" />
      <ScenarioPicker scenarios={scenarios} />
    </main>
  );
}
