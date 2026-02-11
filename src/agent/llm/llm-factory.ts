import type { LLMConfig } from '../../config/config.types';
import type { LLMProvider } from './llm.types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OllamaProvider } from './ollama-provider';
import { MockProvider } from './mock-provider';

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
