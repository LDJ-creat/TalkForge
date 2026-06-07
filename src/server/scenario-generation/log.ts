export function logScenarioGenerate(
  event: string,
  details: Record<string, unknown>,
): void {
  console.info(`[talkforge:scenario-generate] ${event}`, JSON.stringify(details));
}
