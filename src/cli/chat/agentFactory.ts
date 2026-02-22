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
import { ToolRegistry } from '../../agent/tools/tool-registry';
import { checkToolRequirements } from '../../agent/tools/tool-conditions';
import { resolveEnabledGroups } from '../../agent/tools/tool-groups';
import { loadToolConfig, loadToolsFromConfig } from '../../agent/tools/tool-loader';

export async function buildAgent(
  config: MasterMindConfig,
  eventHandler: AgentEventHandler,
): Promise<{ agent: Agent; hookManager: HookManager }> {
  const conversation = createConversationManager();
  const hookManager = createHookManager();
  const registry = new ToolRegistry();

  // 1. Register built-in tools with metadata
  registry.register('bash', createBashTool(config.permissions), {
    group: 'system', source: 'builtin',
  });
  registry.register('cost_query', createCostQueryTool(config.costApi), {
    group: 'cost', source: 'builtin',
    requires: ['env:COST_API_BASE_URL'],
  });
  registry.register('cost_summary', createCostSummaryTool(config.costApi), {
    group: 'cost', source: 'builtin',
    requires: ['env:COST_API_BASE_URL'],
  });
  registry.register('cost_by_service', createCostByServiceTool(config.costApi), {
    group: 'cost', source: 'builtin',
    requires: ['env:COST_API_BASE_URL'],
  });
  registry.register('cloud_cli', cloudCliTool, {
    group: 'cloud', source: 'builtin',
  });
  registry.register('resource_list', resourceListTool, {
    group: 'cloud', source: 'builtin',
  });
  registry.register('resource_metrics', resourceMetricsTool, {
    group: 'cloud', source: 'builtin',
  });

  // 2. Load plugin tools into registry
  const pluginTools = await loadPlugins(config, hookManager);
  for (const [id, tool] of Object.entries(pluginTools)) {
    registry.register(id, tool, { group: 'plugin', source: 'plugin' });
  }

  // 3. Load user-defined tools from config
  if (config.toolConfigPath) {
    const { dirname } = await import('node:path');
    const specs = await loadToolConfig(config.toolConfigPath);
    const configDir = dirname(config.toolConfigPath);
    const userTools = await loadToolsFromConfig(specs, config, configDir);
    for (const [id, tool] of Object.entries(userTools)) {
      registry.register(id, tool, { group: 'user', source: config.toolConfigPath });
    }
  }

  // 4. Conditional injection: remove tools whose requirements aren't met
  for (const id of registry.list()) {
    const meta = registry.getMeta(id);
    if (meta?.requires) {
      const reason = await checkToolRequirements(meta.requires);
      if (reason) {
        console.error(`[agent] Disabling tool "${id}": ${reason}`);
        registry.remove(id);
      }
    }
  }

  // 5. Scope by enabled groups
  const enabledGroups = config.toolGroups ?? resolveEnabledGroups().map(String);
  for (const id of registry.list()) {
    const meta = registry.getMeta(id);
    if (meta && !enabledGroups.includes(meta.group) && meta.group !== 'plugin' && meta.group !== 'user') {
      registry.remove(id);
    }
  }

  // 6. Build agent with filtered tools
  const allTools = registry.all();
  const toolNames = registry.list();
  const systemPrompt = buildSystemPrompt(config, toolNames);

  const mastraAgent = new MastraAgent({
    id: 'master_mind',
    name: 'Master Mind',
    instructions: systemPrompt,
    model: `${config.llm.provider}/${config.llm.model}` as `${string}/${string}`,
    tools: allTools,
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
