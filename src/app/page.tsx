import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { listSeedScenarios } from "@/server/scenario/catalog";

import { ScenarioPicker } from "@/components/scenario-picker";

export default function HomePage() {
  const scenarios = listSeedScenarios();

  return (
    <main className="scenario-page">
      <header className="scenario-page__header">
        <p className="scenario-page__eyebrow">{APP_NAME}</p>
        <h1 className="scenario-page__title">Choose a practice scenario</h1>
        <p className="scenario-page__subtitle">
          {APP_TAGLINE}. Pick a role-play to review past reports and start a new conversation.
        </p>
      </header>
      <ScenarioPicker scenarios={scenarios} />
    </main>
  );
}
