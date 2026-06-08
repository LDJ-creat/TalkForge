import { CEFR_LEVEL_GUIDE, cefrLevelGuideCopy } from "@/lib/cefr-level-guide";

type CefrLevelGuideProps = {
  variant?: "compact" | "full";
  showCreateHint?: boolean;
};

export function CefrLevelGuide({
  variant = "compact",
  showCreateHint = false,
}: CefrLevelGuideProps) {
  return (
    <aside
      className={`cefr-guide cefr-guide--${variant}`}
      data-testid="cefr-level-guide"
      aria-label={cefrLevelGuideCopy.title}
    >
      <h2 className="cefr-guide__title">{cefrLevelGuideCopy.title}</h2>
      <p className="cefr-guide__intro">{cefrLevelGuideCopy.intro}</p>
      <ul className="cefr-guide__list">
        {CEFR_LEVEL_GUIDE.map((entry) => (
          <li key={entry.level} className="cefr-guide__item">
            <span className="cefr-guide__level">{entry.level}</span>
            <span className="cefr-guide__label">{entry.label}</span>
            <span className="cefr-guide__summary">{entry.summary}</span>
          </li>
        ))}
      </ul>
      {showCreateHint ? (
        <p className="cefr-guide__hint">{cefrLevelGuideCopy.createHint}</p>
      ) : null}
    </aside>
  );
}
