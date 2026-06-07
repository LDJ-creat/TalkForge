export class RuntimeConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(formatRuntimeConfigIssues(issues));
    this.name = "RuntimeConfigError";
    this.issues = issues;
  }
}

export function formatRuntimeConfigIssues(issues: string[]): string {
  if (issues.length === 0) {
    return "Runtime configuration is invalid.";
  }

  return [
    "TalkForge runtime configuration is invalid:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

export class ServerOnlyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerOnlyConfigError";
  }
}
