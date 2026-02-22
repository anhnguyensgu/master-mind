export type LLMProviderName = 'anthropic' | 'openai' | 'ollama' | 'google' | 'mock';

export interface LLMConfig {
  provider: LLMProviderName;
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

export interface PermissionsConfig {
  allow?: string[];
  deny?: string[];
}

export interface MasterMindConfig {
  llm: LLMConfig;
  costApi: CostApiConfig;
  agent: AgentBehaviorConfig;
  pluginConfigPath?: string;
  permissions?: PermissionsConfig;
  toolGroups?: string[];
  toolConfigPath?: string;
}
