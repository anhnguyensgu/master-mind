import type { MasterMindConfig, LLMProviderName } from './config.types';

const DEFAULT_MODELS: Record<LLMProviderName, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  ollama: 'llama3',
  mock: 'mock-1.0',
};

const DEFAULT_BASE_URLS: Record<LLMProviderName, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434',
  mock: '',
};

export function loadConfig(): MasterMindConfig {
  const provider = (Bun.env.LLM_PROVIDER as LLMProviderName) || 'anthropic';

  return {
    llm: {
      provider,
      model: Bun.env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic,
      baseUrl: Bun.env.LLM_BASE_URL || DEFAULT_BASE_URLS[provider] || DEFAULT_BASE_URLS.anthropic,
      maxTokens: Number(Bun.env.LLM_MAX_TOKENS) || 4096,
    },
    costApi: {
      baseUrl: Bun.env.COST_API_BASE_URL || 'http://localhost:3000',
      token: Bun.env.COST_API_TOKEN || '',
      defaultProvider: Bun.env.COST_DEFAULT_PROVIDER || 'aws',
    },
    agent: {
      maxIterations: Number(Bun.env.MASTER_MIND_MAX_ITERATIONS) || 10,
    },
    pluginConfigPath: Bun.env.MASTER_MIND_PLUGIN_CONFIG || undefined,
  };
}
