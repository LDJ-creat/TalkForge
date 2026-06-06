import Link from "next/link";

export default function PracticeNotFound() {
  return (
    <main className="scenario-page">
      <section className="conversation-panel" style={{ maxWidth: "36rem", margin: "0 auto" }}>
        <h1 className="scenario-page__title">Scenario not found</h1>
        <p className="scenario-page__subtitle" style={{ marginBottom: "1.5rem" }}>
          That practice scenario does not exist. Choose one from the scenario library.
        </p>
        <Link href="/" className="button button--primary">
          Back to scenarios
        </Link>
      </section>
    </main>
  );
}
