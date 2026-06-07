import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { createAiInvocationTraceService } from "@/server/ai-tracing";
import { getDb } from "@/server/db/client";
import { listAllScenarios } from "@/server/scenario/catalog";
import {
  createCreateCustomScenarioDeps,
  createCustomScenario,
} from "@/server/scenario/create-custom-scenario";
import { ScenarioServiceError } from "@/server/scenario/errors";

import type { CreateScenarioInput } from "@/domain/scenario";

type CreateScenarioRequestBody = {
  scenario: CreateScenarioInput;
};

export async function GET(request: Request) {
  try {
    requireRequestUserId(request);
    const db = getDb();
    const scenarios = await listAllScenarios(db);
    return Response.json({ scenarios });
  } catch (error) {
    if (error instanceof ScenarioServiceError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireRequestUserId(request);
    const body = await readJsonBody<CreateScenarioRequestBody>(request);

    if (!body.scenario || typeof body.scenario !== "object") {
      throw new ScenarioServiceError(400, "invalid_scenario", "scenario is required.");
    }

    const db = getDb();
    const scenario = await createCustomScenario(
      { scenario: body.scenario },
      createCreateCustomScenarioDeps(db),
    );

    return Response.json({ scenario }, { status: 201 });
  } catch (error) {
    if (error instanceof ScenarioServiceError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return jsonError(error);
  }
}
