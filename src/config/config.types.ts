export type LLMProviderName = 'anthropic' | 'openai' | 'ollama' | 'mock';

export interface LLMConfig {
  provider: LLMProviderName;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
}

export interface CostApiConfig {
  baseUrl: string;
  token: string;
  defaultProvider: string;
}

export interface AgentBehaviorConfig {
  maxIterations: number;
}

export interface MasterMindConfig {
  llm: LLMConfig;
  costApi: CostApiConfig;
  agent: AgentBehaviorConfig;
  pluginConfigPath?: string;
}
