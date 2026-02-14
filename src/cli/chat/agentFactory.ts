import { Agent as MastraAgent } from '@mastra/core/agent';
import type { MasterMindConfig, LLMConfig } from '../../config/config.types';
import type { MastraModelConfig } from '@mastra/core/agent';

import { Agent, type AgentEventHandler } from '../../agent/agent';
import { createConversationManager } from '../../agent/conversation';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createHookManager, type HookManager } from '../../agent/plugins/hook-manager';
import { loadPlugins } from '../../agent/plugins/plugin-loader';

function toMastraModelConfig(llm: LLMConfig): MastraModelConfig {
  if (llm.provider === 'ollama') {
    return {
      id: `custom/${llm.model}` as `${string}/${string}`,
      url: `${llm.baseUrl.replace(/\/$/, '')}/v1`,
    };
  }

  // Mastra reads API keys from env vars automatically:
  // ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
  return `${llm.provider}/${llm.model}` as `${string}/${string}`;
}

export async function buildAgent(
  config: MasterMindConfig,
  eventHandler: AgentEventHandler,
): Promise<{ agent: Agent; hookManager: HookManager }> {
  const conversation = createConversationManager();
  const hookManager = createHookManager();

  await loadPlugins(config, hookManager);

  const modelConfig = toMastraModelConfig(config.llm);
  const systemPrompt = buildSystemPrompt(config, []);

  const mastraAgent = new MastraAgent({
    id: 'master_mind',
    name: 'Master Mind',
    instructions: systemPrompt,
    model: modelConfig,
  });

  const agent = new Agent(
    mastraAgent,
    conversation,
    eventHandler,
    config.llm.provider,
    config.llm.model,
    hookManager,
  );

  return { agent, hookManager };
}
