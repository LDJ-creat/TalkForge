import type { Scenario } from "@/domain/scenario";

type ScenarioRoleDisplay = Pick<
  Scenario,
  "userRole" | "aiRole" | "userRoleLabel" | "aiRoleLabel"
>;

export function formatScenarioRoleLine(scenario: ScenarioRoleDisplay): string {
  const userRole = scenario.userRoleLabel ?? scenario.userRole;
  const aiRole = scenario.aiRoleLabel ?? scenario.aiRole;
  return `你：${userRole} · AI：${aiRole}`;
}

export function formatScenarioEntrySubtitle(
  scenario: ScenarioRoleDisplay & Pick<Scenario, "level" | "situation">,
): string {
  return `${formatScenarioRoleLine(scenario)} · ${scenario.level} · ${scenario.situation}`;
}
