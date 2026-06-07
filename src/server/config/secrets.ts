import { ServerOnlyConfigError } from "./errors";
import { getRuntimeConfig } from "./runtime-config";
import type { RuntimeSecrets } from "./types";

export function assertServerOnly(context: string): void {
  if (typeof window !== "undefined") {
    throw new ServerOnlyConfigError(
      `${context} must only be accessed on the server.`,
    );
  }
}

export function getRuntimeSecret<K extends keyof RuntimeSecrets>(
  key: K,
): RuntimeSecrets[K] {
  assertServerOnly(`Runtime secret "${String(key)}"`);
  return getRuntimeConfig().secrets[key];
}

export function requireRuntimeSecret<K extends keyof RuntimeSecrets>(
  key: K,
  envKey: string,
): NonNullable<RuntimeSecrets[K]> {
  const value = getRuntimeSecret(key);
  if (!value) {
    throw new Error(`${envKey} is required but not configured.`);
  }
  return value;
}
