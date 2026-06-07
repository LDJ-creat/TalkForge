import {
  buildTextLlmProviderCacheKey,
  createOpenAiCompatibleTextLlmProvider,
} from "@/providers/openai-compatible-text-llm";
import { getRuntimeConfig } from "@/server/config";

type CachedTextLlmProvider = ReturnType<typeof createOpenAiCompatibleTextLlmProvider>;

const cachedTextLlmProviders = new Map<string, CachedTextLlmProvider>();

function buildConfiguredProviderCacheKey(providerName: string): string {
  const { secrets } = getRuntimeConfig();

  return buildTextLlmProviderCacheKey({
    providerName,
    apiKey: secrets.llmApiKey ?? "",
    apiBaseUrl: secrets.llmBaseUrl,
    model: secrets.llmModel,
  });
}

export function getOrCreateOpenAiCompatibleTextLlmProvider(
  providerName: string,
): CachedTextLlmProvider {
  const { secrets } = getRuntimeConfig();
  const cacheKey = buildConfiguredProviderCacheKey(providerName);
  const cached = cachedTextLlmProviders.get(cacheKey);

  if (cached) {
    return cached;
  }

  const provider = createOpenAiCompatibleTextLlmProvider({
    providerName,
    apiKey: secrets.llmApiKey ?? "",
    apiBaseUrl: secrets.llmBaseUrl,
    model: secrets.llmModel,
  });
  cachedTextLlmProviders.set(cacheKey, provider);

  return provider;
}

export function resetOpenAiCompatibleTextLlmProviderCacheForTests(): void {
  cachedTextLlmProviders.clear();
}
