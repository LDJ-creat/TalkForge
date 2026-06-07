import { createProviderError } from "@/providers/errors";

import { linkAbortSignals, type ProviderCallContext } from "./context";

export type WithProviderTimeoutOptions = {
  timeoutMs: number;
  provider: string;
  operation: string;
  /** Optional upstream signal; aborted when the runtime timeout fires. */
  signal?: AbortSignal;
};

export async function withProviderTimeout<T>(
  fn: (context: ProviderCallContext) => Promise<T>,
  options: WithProviderTimeoutOptions,
): Promise<T> {
  const { timeoutMs, provider, operation, signal: upstreamSignal } = options;
  const timeoutController = new AbortController();
  const callSignal = linkAbortSignals(timeoutController.signal, upstreamSignal);

  if (timeoutMs <= 0) {
    return fn({ signal: callSignal });
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      timeoutController.abort(
        createProviderError({
          provider,
          code: "timeout",
          message: `${operation} timed out after ${timeoutMs}ms.`,
          retryable: true,
          metadata: {
            operation,
            timeoutMs,
          },
        }),
      );
      reject(timeoutController.signal.reason);
    }, timeoutMs);

    fn({ signal: callSignal })
      .then((value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}
