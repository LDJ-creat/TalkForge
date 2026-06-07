import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AiTraceArtifactKind } from "../object-keys";
import { buildAiTraceLocalRelativePath } from "../object-keys";
import { serializeTracePayload } from "../redact";

export type WriteLocalRawTraceInput = {
  rootDir: string;
  logId: string;
  kind: AiTraceArtifactKind;
  payload: unknown;
  redactPii: boolean;
};

export async function writeLocalRawTrace(
  input: WriteLocalRawTraceInput,
): Promise<string> {
  const relativePath = buildAiTraceLocalRelativePath(input.logId, input.kind);
  const absolutePath = path.resolve(input.rootDir, relativePath);
  const rootDir = path.resolve(input.rootDir);

  if (!absolutePath.startsWith(rootDir + path.sep) && absolutePath !== rootDir) {
    throw new Error(`Refusing to write trace outside configured root: ${relativePath}`);
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(
    absolutePath,
    serializeTracePayload(input.payload, input.redactPii),
    "utf8",
  );

  return relativePath;
}
