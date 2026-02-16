import { Agent as MastraAgent } from '@mastra/core/agent';
import type { MasterMindConfig } from '../../config/config.types';
import { Agent, type AgentEventHandler } from '../../agent/agent';
import { createConversationManager } from '../../agent/conversation';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createHookManager, type HookManager } from '../../agent/plugins/hook-manager';
import { loadPlugins } from '../../agent/plugins/plugin-loader';
import {
  testTool,
  bashTool,
  cloudCliTool,
  resourceListTool,
  resourceMetricsTool,
} from '../../agent/tools';

export async function buildAgent(
  config: MasterMindConfig,
  eventHandler: AgentEventHandler,
): Promise<{ agent: Agent; hookManager: HookManager }> {
  const conversation = createConversationManager();
  const hookManager = createHookManager();

  await loadPlugins(config, hookManager);

  const toolNames = ['cost_query', 'bash', 'cloud_cli', 'resource_list', 'resource_metrics'];
  const systemPrompt = buildSystemPrompt(config, toolNames);

  const mastraAgent = new MastraAgent({
    id: 'master_mind',
    name: 'Master Mind',
    instructions: systemPrompt,
    model: `${config.llm.provider}/${config.llm.model}` as `${string}/${string}`,
    tools: {
      cost_query: testTool,
      bash: bashTool,
      cloud_cli: cloudCliTool,
      resource_list: resourceListTool,
      resource_metrics: resourceMetricsTool,
    },
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
