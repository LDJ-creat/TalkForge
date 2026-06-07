import { createProviderError } from "@/providers/errors";

export const OPENAI_COMPATIBLE_PROVIDER_FAMILY = "openai-compatible-text-llm" as const;

export const KNOWN_TEXT_LLM_PROVIDER_NAMES = ["openai", "dashscope"] as const;

export type KnownTextLlmProviderName = (typeof KNOWN_TEXT_LLM_PROVIDER_NAMES)[number];

export const DEFAULT_OPENAI_API_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-4o-mini";

export const DEFAULT_DASHSCOPE_COMPATIBLE_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_DASHSCOPE_TEXT_MODEL = "qwen-plus";

export type OpenAiCompatibleTextLlmConfig = {
  providerName: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
};

export function isKnownTextLlmProviderName(
  providerName: string,
): providerName is KnownTextLlmProviderName {
  return KNOWN_TEXT_LLM_PROVIDER_NAMES.includes(providerName as KnownTextLlmProviderName);
}

export function isSupportedTextLlmProviderName(
  providerName: string,
  options?: { llmBaseUrl?: string },
): boolean {
  if (providerName === "mock") {
    return false;
  }

  if (isKnownTextLlmProviderName(providerName)) {
    return true;
  }

  return Boolean(options?.llmBaseUrl?.trim());
}

export function resolveTextLlmDefaults(providerName: string): {
  apiBaseUrl: string;
  model: string;
} {
  if (providerName === "dashscope") {
    return {
      apiBaseUrl: DEFAULT_DASHSCOPE_COMPATIBLE_BASE_URL,
      model: DEFAULT_DASHSCOPE_TEXT_MODEL,
    };
  }

  if (providerName === "openai") {
    return {
      apiBaseUrl: DEFAULT_OPENAI_API_BASE_URL,
      model: DEFAULT_OPENAI_TEXT_MODEL,
    };
  }

  throw createProviderError({
    provider: providerName,
    code: "configuration",
    message: `Custom text LLM provider "${providerName}" requires LLM_BASE_URL to be configured.`,
    retryable: false,
  });
}

export function buildOpenAiCompatibleTextLlmConfig(options: {
  providerName: string;
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
}): OpenAiCompatibleTextLlmConfig {
  if (isKnownTextLlmProviderName(options.providerName)) {
    const defaults = resolveTextLlmDefaults(options.providerName);

    return {
      providerName: options.providerName,
      apiKey: options.apiKey,
      apiBaseUrl: (options.apiBaseUrl ?? defaults.apiBaseUrl).replace(/\/+$/, ""),
      model: options.model ?? defaults.model,
    };
  }

  const apiBaseUrl = options.apiBaseUrl?.trim();
  if (!apiBaseUrl) {
    throw createProviderError({
      provider: options.providerName,
      code: "configuration",
      message: `LLM_BASE_URL is required for custom text LLM provider "${options.providerName}".`,
      retryable: false,
    });
  }

  return {
    providerName: options.providerName,
    apiKey: options.apiKey,
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    model: options.model ?? DEFAULT_OPENAI_TEXT_MODEL,
  };
}

export function buildChatCompletionsUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}/chat/completions`;
}

export function buildTextLlmProviderCacheKey(options: {
  providerName: string;
  apiKey: string;
  apiBaseUrl?: string;
  model?: string;
}): string {
  const defaults = isKnownTextLlmProviderName(options.providerName)
    ? resolveTextLlmDefaults(options.providerName)
    : undefined;

  return [
    options.providerName,
    options.apiKey,
    options.apiBaseUrl ?? defaults?.apiBaseUrl ?? "",
    options.model ?? defaults?.model ?? DEFAULT_OPENAI_TEXT_MODEL,
  ].join("|");
}
