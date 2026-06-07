import { getRuntimeConfig } from "@/server/config";

export function isHealthDetailAuthorized(request: Request): boolean {
  const config = getRuntimeConfig();

  if (config.nodeEnv !== "production") {
    return true;
  }

  const configuredToken = config.secrets.opsHealthDetailToken?.trim();
  if (!configuredToken) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim() === configuredToken;
  }

  const headerToken = request.headers.get("x-ops-health-token")?.trim();
  return headerToken === configuredToken;
}
