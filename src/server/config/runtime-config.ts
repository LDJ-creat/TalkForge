import { parseRuntimeConfigFromEnv } from "./parse-env";
import { validateRuntimeConfig } from "./validate";
import type { RuntimeConfig } from "./types";

let cachedConfig: RuntimeConfig | undefined;

export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    cachedConfig = validateRuntimeConfig(parseRuntimeConfigFromEnv());
  }
  return cachedConfig;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  cachedConfig = validateRuntimeConfig(parseRuntimeConfigFromEnv(env), env);
  return cachedConfig;
}

export function resetRuntimeConfigForTests(): void {
  cachedConfig = undefined;
}
