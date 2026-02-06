import type { ProviderConfig, CloudProviderName } from './costs.types';

function loadAwsConfigFromEnv(): ProviderConfig | null {
  const accessKeyId = Bun.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = Bun.env.AWS_SECRET_ACCESS_KEY;
  const region = Bun.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) return null;

  return {
    provider: 'aws',
    accessKeyId,
    secretAccessKey,
    region,
    accountId: Bun.env.AWS_ACCOUNT_ID,
  };
}

async function loadConfigFromFile(): Promise<ProviderConfig[] | null> {
  const configPath = Bun.env.COST_CONFIG_PATH;
  if (!configPath) return null;

  const file = Bun.file(configPath);
  if (!(await file.exists())) return null;

  const contents = await file.json();
  return contents.providers ?? null;
}

export async function loadProviderConfigs(): Promise<
  Map<CloudProviderName, ProviderConfig>
> {
  const configs = new Map<CloudProviderName, ProviderConfig>();

  // Config file takes precedence
  const fileConfigs = await loadConfigFromFile();
  if (fileConfigs) {
    for (const cfg of fileConfigs) {
      configs.set(cfg.provider, cfg);
    }
  }

  // Env vars as fallback
  if (!configs.has('aws')) {
    const awsEnv = loadAwsConfigFromEnv();
    if (awsEnv) configs.set('aws', awsEnv);
  }

  return configs;
}

export function getDefaultProviderName(): CloudProviderName {
  const envDefault = Bun.env.COST_DEFAULT_PROVIDER as
    | CloudProviderName
    | undefined;
  return envDefault ?? 'aws';
}
