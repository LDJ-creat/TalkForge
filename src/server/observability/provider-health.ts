import { createProviderError } from "@/providers/errors";
import {
  createStaticProviderHealthCheck,
  runProviderHealthCheck,
  type ProviderHealthCheckResult,
} from "@/providers/runtime";
import { getRuntimeConfig, type RuntimeConfig } from "@/server/config";

export type ProviderHealthReport = {
  ok: boolean;
  providers: ProviderHealthCheckResult[];
};

function requireConfiguredSecret(
  provider: string,
  value: string | undefined,
  label: string,
): void {
  if (!value?.trim()) {
    throw createProviderError({
      provider,
      code: "configuration",
      message: `${label} is not configured.`,
      retryable: false,
    });
  }
}

function createConfigurationHealthCheck(input: {
  provider: string;
  validate: () => void | Promise<void>;
}) {
  return createStaticProviderHealthCheck({
    provider: input.provider,
    checkKind: "configuration",
    check: () => input.validate(),
  });
}

function buildConfiguredProviderHealthChecks(config: RuntimeConfig) {
  const checks = [];
  const { providers, secrets } = config;

  if (providers.realtime.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.realtime.name,
        validate: () => {
          requireConfiguredSecret(
            providers.realtime.name,
            secrets.realtimeApiKey,
            "REALTIME_API_KEY",
          );
        },
      }),
    );
  } else {
    checks.push(
      createStaticProviderHealthCheck({
        provider: "mock-realtime",
        checkKind: "configuration",
        check: () => undefined,
      }),
    );
  }

  if (providers.asr.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.asr.name,
        validate: () => {
          requireConfiguredSecret(providers.asr.name, secrets.asrApiKey, "ASR_API_KEY");
        },
      }),
    );
  }

  if (providers.llmCorrection.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.llmCorrection.name,
        validate: () => {
          requireConfiguredSecret(
            providers.llmCorrection.name,
            secrets.llmApiKey,
            "LLM_API_KEY",
          );
        },
      }),
    );
  }

  if (providers.llmReport.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: `${providers.llmReport.name}:report`,
        validate: () => {
          requireConfiguredSecret(
            providers.llmReport.name,
            secrets.llmApiKey,
            "LLM_API_KEY",
          );
        },
      }),
    );
  }

  if (providers.llmGoalJudge.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: `${providers.llmGoalJudge.name}:goal-judge`,
        validate: () => {
          requireConfiguredSecret(
            providers.llmGoalJudge.name,
            secrets.llmApiKey,
            "LLM_API_KEY",
          );
        },
      }),
    );
  }

  if (providers.tts.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.tts.name,
        validate: () => {
          requireConfiguredSecret(providers.tts.name, secrets.ttsApiKey, "TTS_API_KEY");
        },
      }),
    );
  }

  if (providers.pronunciation.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.pronunciation.name,
        validate: () => {
          requireConfiguredSecret(
            providers.pronunciation.name,
            secrets.pronunciationApiKey,
            "PRONUNCIATION_API_KEY",
          );
          requireConfiguredSecret(
            providers.pronunciation.name,
            secrets.pronunciationApiSecret,
            "PRONUNCIATION_API_SECRET",
          );
          requireConfiguredSecret(
            providers.pronunciation.name,
            secrets.pronunciationAppId,
            "PRONUNCIATION_APP_ID",
          );
        },
      }),
    );
  }

  if (providers.storage.mode === "real") {
    checks.push(
      createConfigurationHealthCheck({
        provider: providers.storage.name,
        validate: () => {
          requireConfiguredSecret(
            providers.storage.name,
            secrets.storageBucket,
            "STORAGE_BUCKET",
          );
          requireConfiguredSecret(
            providers.storage.name,
            secrets.storageAccessKeyId,
            "STORAGE_ACCESS_KEY_ID",
          );
          requireConfiguredSecret(
            providers.storage.name,
            secrets.storageSecretAccessKey,
            "STORAGE_SECRET_ACCESS_KEY",
          );
        },
      }),
    );
  }

  return checks;
}

export async function checkConfiguredProviderHealth(
  config: RuntimeConfig = getRuntimeConfig(),
): Promise<ProviderHealthReport> {
  const checks = buildConfiguredProviderHealthChecks(config);
  const providers = await Promise.all(checks.map((check) => runProviderHealthCheck(check)));

  return {
    ok: providers.every((result) => result.ok),
    providers,
  };
}
