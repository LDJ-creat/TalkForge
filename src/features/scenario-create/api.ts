import type { CreateScenarioInput, Scenario } from "@/domain/scenario";
import type { ScenarioDraft } from "@/providers/llm/scenario-generate-types";
import { REQUEST_USER_ID_HEADER, resolveClientRequestUserId } from "@/shared/request-user";

export type GenerateScenarioResponse = {
  scenario: ScenarioDraft;
  provider: string;
  promptVersion: string;
};

export type CreateScenarioResponse = {
  scenario: Scenario;
};

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;

  return body?.error?.message ?? `Request failed (${response.status}).`;
}

export async function generateScenarioFromDescription(
  description: string,
  userId?: string,
): Promise<GenerateScenarioResponse> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch("/api/scenarios/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as GenerateScenarioResponse;
}

export async function createScenarioOnServer(
  scenario: CreateScenarioInput,
  userId?: string,
): Promise<CreateScenarioResponse> {
  const resolvedUserId = resolveClientRequestUserId(userId);

  const response = await fetch("/api/scenarios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [REQUEST_USER_ID_HEADER]: resolvedUserId,
    },
    body: JSON.stringify({ scenario }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as CreateScenarioResponse;
}
