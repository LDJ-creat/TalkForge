import { jsonError, readJsonBody, requireRequestUserId } from "@/server/api/http";
import { createAiInvocationTraceService } from "@/server/ai-tracing";
import { getDb } from "@/server/db/client";
import {
  createGenerateScenarioDeps,
  generateScenarioFromDescription,
} from "@/server/scenario/generate-scenario";
import { ScenarioServiceError } from "@/server/scenario/errors";

type GenerateScenarioRequestBody = {
  description?: string;
};

export async function POST(request: Request) {
  try {
    requireRequestUserId(request);
    const body = await readJsonBody<GenerateScenarioRequestBody>(request);
    const db = getDb();
    const traceWriter = createAiInvocationTraceService({ db });

    const result = await generateScenarioFromDescription(
      { description: body.description ?? "" },
      createGenerateScenarioDeps({ traceWriter }),
    );

    return Response.json(result);
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
