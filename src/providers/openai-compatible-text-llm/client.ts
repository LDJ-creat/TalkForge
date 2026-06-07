import { createProviderError, type ProviderErrorCode } from "@/providers/errors";
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

type ProviderErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

function resolveProviderErrorCode(
  status: number,
  payload?: ProviderErrorPayload,
): ProviderErrorCode {
  const apiErrorCode = `${payload?.error?.code ?? ""} ${payload?.error?.type ?? ""}`.toLowerCase();

  if (status === 401 || apiErrorCode.includes("invalidapikey")) {
    return "authentication";
  }

  if (
    status === 429 ||
    apiErrorCode.includes("quota") ||
    apiErrorCode.includes("ratelimit") ||
    apiErrorCode.includes("throttl")
  ) {
    return "rate_limited";
  }

  if (status === 403) {
    return "authorization";
  }

  if (status === 404) {
    return "not_found";
  }
  if (status === 408 || status === 504) {
    return "timeout";
  }
  if (status >= 400 && status < 500) {
    return "invalid_request";
  }
  return "provider_unavailable";
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
  let payload: ChatCompletionResponse | ProviderErrorPayload | undefined;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as ChatCompletionResponse | ProviderErrorPayload;
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const errorPayload =
      typeof payload === "object" && payload && "error" in payload
        ? (payload as ProviderErrorPayload)
        : undefined;
    const message =
      typeof errorPayload?.error?.message === "string"
        ? errorPayload.error.message
        : responseText || `Text LLM request failed with status ${response.status}.`;
    const code = resolveProviderErrorCode(response.status, errorPayload);

    throw createProviderError({
      provider: config.providerName,
      code,
      message,
      retryable: isRetryableStatus(response.status) || code === "rate_limited",
      metadata: {
        status: response.status,
        apiErrorCode: errorPayload?.error?.code,
        apiErrorType: errorPayload?.error?.type,
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
