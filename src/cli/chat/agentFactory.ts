import { Agent as MastraAgent } from '@mastra/core/agent';
import type { MasterMindConfig } from '../../config/config.types';
import { Agent, type AgentEventHandler } from '../../agent/agent';
import { createConversationManager } from '../../agent/conversation';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createHookManager, type HookManager } from '../../agent/plugins/hook-manager';
import { loadPlugins } from '../../agent/plugins/plugin-loader';
import {
  createBashTool,
  cloudCliTool,
  resourceListTool,
  resourceMetricsTool,
  createCostQueryTool,
  createCostSummaryTool,
  createCostByServiceTool,
} from '../../agent/tools';

export async function buildAgent(
  config: MasterMindConfig,
  eventHandler: AgentEventHandler,
): Promise<{ agent: Agent; hookManager: HookManager }> {
  const conversation = createConversationManager();
  const hookManager = createHookManager();

  await loadPlugins(config, hookManager);

  const bashTool = createBashTool(config.permissions);
  const costQueryTool = createCostQueryTool(config.costApi);
  const costSummaryTool = createCostSummaryTool(config.costApi);
  const costByServiceTool = createCostByServiceTool(config.costApi);

  const toolNames = ['cost_query', 'cost_summary', 'cost_by_service', 'bash', 'cloud_cli', 'resource_list', 'resource_metrics'];
  const systemPrompt = buildSystemPrompt(config, toolNames);

  const mastraAgent = new MastraAgent({
    id: 'master_mind',
    name: 'Master Mind',
    instructions: systemPrompt,
    model: `${config.llm.provider}/${config.llm.model}` as `${string}/${string}`,
    tools: {
      cost_query: costQueryTool,
      cost_summary: costSummaryTool,
      cost_by_service: costByServiceTool,
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
