import Link from "next/link";

import { navCopy, notFoundCopy } from "@/lib/ui-copy";

export default function PracticeNotFound() {
  return (
    <main className="scenario-page">
      <section className="conversation-panel" style={{ maxWidth: "36rem", margin: "0 auto" }}>
        <h1 className="scenario-page__title">{notFoundCopy.title}</h1>
        <p className="scenario-page__subtitle" style={{ marginBottom: "1.5rem" }}>
          {notFoundCopy.description}
        </p>
        <Link href="/" className="button button--primary">
          {navCopy.backToScenariosButton}
        </Link>
      </section>
    </main>
  );
}
