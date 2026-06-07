import { getRuntimeConfig } from "./runtime-config";
import type { PublicClientConfig } from "./types";

/** Safe browser-visible configuration. Never includes API keys or signing secrets. */
export function getPublicClientConfig(): PublicClientConfig {
  return getRuntimeConfig().public;
}
