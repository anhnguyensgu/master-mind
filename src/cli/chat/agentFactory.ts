import { Agent as MastraAgent } from '@mastra/core/agent';
import type { MasterMindConfig } from '../../config/config.types';
import { Agent, type AgentEventHandler } from '../../agent/agent';
import { createConversationManager, createPersistentConversationManager } from '../../agent/conversation';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createHookManager, type HookManager } from '../../agent/plugins/hook-manager';
import { loadPlugins } from '../../agent/plugins/plugin-loader';
import type { SessionStore } from '../../agent/session-store';
import {
  createBashTool,
  cloudCliTool,
  resourceListTool,
  resourceMetricsTool,
  createCostQueryTool,
  createCostSummaryTool,
  createCostByServiceTool,
} from '../../agent/tools';

export interface BuildAgentOptions {
  config: MasterMindConfig;
  eventHandler: AgentEventHandler;
  sessionStore?: SessionStore;
  resumeSessionId?: string;
}

export interface BuildAgentResult {
  agent: Agent;
  hookManager: HookManager;
  sessionId: string | null;
}

export async function buildAgent(options: BuildAgentOptions): Promise<BuildAgentResult> {
  const { config, eventHandler, sessionStore, resumeSessionId } = options;

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

  let conversation;
  let sessionId: string | null = null;
  let resumedMessages: Array<{ role: 'user' | 'assistant'; content: string }> | null = null;

  if (sessionStore && resumeSessionId) {
    resumedMessages = sessionStore.getMessages(resumeSessionId);
    conversation = createPersistentConversationManager(sessionStore, resumeSessionId, resumedMessages);
    sessionId = resumeSessionId;
  } else if (sessionStore) {
    sessionId = sessionStore.createSession(config.llm.provider, config.llm.model);
    conversation = createPersistentConversationManager(sessionStore, sessionId);
  } else {
    conversation = createConversationManager();
  }

  const agent = new Agent(
    mastraAgent,
    conversation,
    eventHandler,
    config.llm.provider,
    config.llm.model,
    hookManager,
  );

  if (resumedMessages) {
    agent.loadMessages(resumedMessages);
  }

  return { agent, hookManager, sessionId };
}
