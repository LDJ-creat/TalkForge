import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { AudioUploadServiceError } from "./errors";

const DEV_STORAGE_SIGNING_SECRET = "talkforge-dev-storage-secret";

export type StorageUploadTokenClaims = {
  objectKey: string;
  contentType: string;
  sizeBytes?: number;
  exp: number;
};

export function getStorageSigningSecret(): string {
  const configured = process.env.STORAGE_SIGNING_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!configured) {
      throw new Error(
        "STORAGE_SIGNING_SECRET is required when NODE_ENV=production.",
      );
    }
    return configured;
  }
  return configured ?? DEV_STORAGE_SIGNING_SECRET;
}

export function createLocalStorageSigningSecret(): string {
  return randomBytes(32).toString("base64url");
}

function signPayload(payloadBase64Url: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64Url).digest("base64url");
}

export function createStorageUploadToken(
  input: {
    objectKey: string;
    contentType: string;
    sizeBytes?: number;
    expiresAt: string;
  },
  secret = getStorageSigningSecret(),
): string {
  const payload: StorageUploadTokenClaims = {
    objectKey: input.objectKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    exp: Math.floor(new Date(input.expiresAt).getTime() / 1000),
  };
  const payloadBase64Url = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadBase64Url}.${signPayload(payloadBase64Url, secret)}`;
}

export function decodeStorageUploadToken(
  token: string,
  secret = getStorageSigningSecret(),
): StorageUploadTokenClaims {
  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) {
    throw new AudioUploadServiceError(400, "invalid_upload_token", "Upload token is malformed.");
  }

  const expectedSignature = signPayload(payloadBase64Url, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AudioUploadServiceError(401, "invalid_upload_token", "Upload token signature is invalid.");
  }

  const claims = JSON.parse(
    Buffer.from(payloadBase64Url, "base64url").toString("utf8"),
  ) as StorageUploadTokenClaims;

  if (claims.exp * 1000 <= Date.now()) {
    throw new AudioUploadServiceError(401, "upload_token_expired", "Upload token has expired.");
  }

  return claims;
}

export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

export function createStorageUploadUrl(token: string, baseUrl = getAppBaseUrl()): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}/api/internal/storage/upload?token=${encodeURIComponent(token)}`;
}
