import type { UploadCapableStorageProvider } from "@/server/storage/upload-capable";

import type { AiTraceArtifactKind } from "../object-keys";
import { buildAiTraceObjectKey } from "../object-keys";
import { serializeTracePayload } from "../redact";

export type WriteObjectStorageRawTraceInput = {
  storage: UploadCapableStorageProvider;
  logId: string;
  kind: AiTraceArtifactKind;
  payload: unknown;
  redactPii: boolean;
};

export async function writeObjectStorageRawTrace(
  input: WriteObjectStorageRawTraceInput,
): Promise<string> {
  const objectKey = buildAiTraceObjectKey(input.logId, input.kind);
  const body = Buffer.from(
    serializeTracePayload(input.payload, input.redactPii),
    "utf8",
  );

  await input.storage.writeUploadedObject({
    objectKey,
    body,
    contentType: "application/json",
  });

  return objectKey;
}
