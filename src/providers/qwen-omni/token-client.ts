import { createProviderError } from "@/providers/errors";
import type { ProviderCallContext } from "@/providers/runtime";

import {
  buildQwenOmniTokenUrl,
  type QwenOmniEndpointConfig,
} from "./config";

export type QwenOmniTemporaryToken = {
  token: string;
  expiresAt: string;
};

export type QwenOmniTokenSuccessResponse = {
  token: string;
  expires_at: number;
};

export type QwenOmniTokenErrorResponse = {
  code?: string;
  message?: string;
  request_id?: string;
};

function parseTokenResponseBody(rawBody: string): QwenOmniTokenSuccessResponse | QwenOmniTokenErrorResponse {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as QwenOmniTokenSuccessResponse | QwenOmniTokenErrorResponse;
  } catch {
    return {};
  }
}

function isTokenSuccessResponse(
  body: QwenOmniTokenSuccessResponse | QwenOmniTokenErrorResponse,
): body is QwenOmniTokenSuccessResponse {
  return "token" in body && "expires_at" in body &&
    typeof body.token === "string" &&
    typeof body.expires_at === "number";
}

export type MintQwenOmniTemporaryTokenInput = {
  apiKey: string;
  endpoints: QwenOmniEndpointConfig;
  expireInSec: number;
  providerName: string;
  context?: ProviderCallContext;
};

function mapTokenErrorCode(status: number, body?: QwenOmniTokenErrorResponse) {
  const message = body?.message?.toLowerCase() ?? "";

  if (status === 401 || body?.code === "InvalidApiKey") {
    return "authentication" as const;
  }
  if (status === 403) {
    return "authorization" as const;
  }
  if (status === 429 || message.includes("rate limit")) {
    return "rate_limited" as const;
  }
  if (status >= 500) {
    return "provider_unavailable" as const;
  }
  return "invalid_request" as const;
}

export async function mintQwenOmniTemporaryToken(
  input: MintQwenOmniTemporaryTokenInput,
): Promise<QwenOmniTemporaryToken> {
  const response = await fetch(buildQwenOmniTokenUrl(input.endpoints, input.expireInSec), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    signal: input.context?.signal,
  });

  const rawBody = await response.text();
  const parsedBody = parseTokenResponseBody(rawBody);

  if (!response.ok) {
    const errorBody = isTokenSuccessResponse(parsedBody) ? undefined : parsedBody;
    throw createProviderError({
      provider: input.providerName,
      code: mapTokenErrorCode(response.status, errorBody),
      message:
        errorBody?.message ||
        `Failed to mint Qwen Omni temporary token (HTTP ${response.status}).`,
      metadata: {
        status: response.status,
        requestId: errorBody?.request_id,
      },
    });
  }

  if (!isTokenSuccessResponse(parsedBody)) {
    throw createProviderError({
      provider: input.providerName,
      code: "invalid_request",
      message: "Qwen Omni token response was missing token or expires_at.",
    });
  }

  return {
    token: parsedBody.token,
    expiresAt: new Date(parsedBody.expires_at * 1000).toISOString(),
  };
}
