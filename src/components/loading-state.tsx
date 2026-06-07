type LoadingStateProps = {
  label?: string;
  variant?: "page" | "inline" | "skeleton-cards";
  testId?: string;
};

export function LoadingState({
  label,
  variant = "inline",
  testId,
}: LoadingStateProps) {
  if (variant === "skeleton-cards") {
    return (
      <div className="loading-state loading-state--skeleton" data-testid={testId} role="status">
        <div className="loading-state__skeleton-list" aria-hidden="true">
          <div className="loading-state__skeleton-card">
            <span className="loading-state__skeleton-line loading-state__skeleton-line--short" />
            <span className="loading-state__skeleton-line loading-state__skeleton-line--long" />
            <span className="loading-state__skeleton-line loading-state__skeleton-line--medium" />
          </div>
          <div className="loading-state__skeleton-card">
            <span className="loading-state__skeleton-line loading-state__skeleton-line--short" />
            <span className="loading-state__skeleton-line loading-state__skeleton-line--long" />
            <span className="loading-state__skeleton-line loading-state__skeleton-line--medium" />
          </div>
        </div>
        {label ? <p className="loading-state__label">{label}</p> : null}
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="loading-state loading-state--page" data-testid={testId} role="status">
        <div className="loading-state__orb" aria-hidden="true">
          <span className="loading-state__ring loading-state__ring--one" />
          <span className="loading-state__ring loading-state__ring--two" />
          <span className="loading-state__ring loading-state__ring--three" />
        </div>
        {label ? <p className="loading-state__label">{label}</p> : null}
      </div>
    );
  }

  return (
    <div className="loading-state loading-state--inline" data-testid={testId} role="status">
      <span className="loading-state__dots" aria-hidden="true">
        <span className="loading-state__dot" />
        <span className="loading-state__dot" />
        <span className="loading-state__dot" />
      </span>
      {label ? <p className="loading-state__label">{label}</p> : null}
    </div>
  );
}
