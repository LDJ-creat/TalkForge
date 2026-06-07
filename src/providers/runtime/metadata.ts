import type { ProviderErrorCode } from "@/providers/errors";

export type ProviderCallStatus = "success" | "error";

export type ProviderCallMetadata = {
  provider: string;
  operation: string;
  latencyMs: number;
  status: ProviderCallStatus;
  retryCount: number;
  errorCode?: ProviderErrorCode;
};

export type ProviderCallMetadataListener = (metadata: ProviderCallMetadata) => void;

export function createProviderCallMetadata(
  input: Omit<ProviderCallMetadata, "latencyMs"> & { startedAtMs: number },
): ProviderCallMetadata {
  return {
    provider: input.provider,
    operation: input.operation,
    latencyMs: Math.max(0, Date.now() - input.startedAtMs),
    status: input.status,
    retryCount: input.retryCount,
    errorCode: input.errorCode,
  };
}
