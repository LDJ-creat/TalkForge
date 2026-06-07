import { createProviderError } from "@/providers/errors";
import type { ProviderCallContext } from "@/providers/runtime";

import { buildChatCompletionsUrl, type OpenAiCompatibleTextLlmConfig } from "./config";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  response_format?: {
    type: "json_object";
  };
};

export type ChatCompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type ChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: ChatCompletionUsage;
};

export type ChatCompletionResult = {
  content: string;
  model: string;
  usage?: ChatCompletionUsage;
  finishReason?: string | null;
};

function mapHttpStatusToProviderCode(status: number) {
  if (status === 401 || status === 403) {
    return "authentication" as const;
  }
  if (status === 404) {
    return "not_found" as const;
  }
  if (status === 408 || status === 504) {
    return "timeout" as const;
  }
  if (status === 429) {
    return "rate_limited" as const;
  }
  if (status >= 400 && status < 500) {
    return "invalid_request" as const;
  }
  return "provider_unavailable" as const;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function createChatCompletion(
  config: OpenAiCompatibleTextLlmConfig,
  request: ChatCompletionRequest,
  context: ProviderCallContext,
): Promise<ChatCompletionResult> {
  const response = await fetch(buildChatCompletionsUrl(config.apiBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: context.signal,
  });

  const responseText = await response.text();
  let payload: ChatCompletionResponse | undefined;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as ChatCompletionResponse;
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof (payload as { error?: { message?: string } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : responseText || `Text LLM request failed with status ${response.status}.`;

    throw createProviderError({
      provider: config.providerName,
      code: mapHttpStatusToProviderCode(response.status),
      message,
      retryable: isRetryableStatus(response.status),
      metadata: {
        status: response.status,
      },
    });
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw createProviderError({
      provider: config.providerName,
      code: "provider_unavailable",
      message: "Text LLM response did not include message content.",
      retryable: true,
    });
  }

  return {
    content,
    model: payload?.model ?? request.model,
    usage: payload?.usage,
    finishReason: payload?.choices?.[0]?.finish_reason ?? null,
  };
}
