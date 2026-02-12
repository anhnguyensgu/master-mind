import { createElement } from 'react';
import { render } from 'ink';
import { loadConfig } from '../config/config';
import type { MasterMindConfig } from '../config/config.types';
import { createAgent, type Agent } from '../agent/agent';
import { createLLMProvider } from '../agent/llm/llm-factory';
import { createConversationManager } from '../agent/conversation';
import { createToolRegistry } from '../agent/tool-registry';
import { buildSystemPrompt } from '../agent/system-prompt';
import { createCostSummaryTool } from '../agent/tools/cost-summary';
import { createCostByServiceTool } from '../agent/tools/cost-by-service';
import { createCostQueryTool } from '../agent/tools/cost-query';
import { createBashTool } from '../agent/tools/bash';
import { createCloudCliTool } from '../agent/tools/cloud-cli';
import { createResourceListTool } from '../agent/tools/resource-list';
import { createResourceMetricsTool } from '../agent/tools/resource-metrics';
import { createOptimizationTool } from '../agent/tools/optimization';
import type { Renderer } from './renderer';
import type { Spinner } from './spinner';
import { App } from './App';

export function buildAgent(config: MasterMindConfig, renderer: Renderer, spinner: Spinner): Agent {
  const provider = createLLMProvider(config.llm);
  const conversation = createConversationManager();
  const toolRegistry = createToolRegistry();

  const tools = [
    createCostSummaryTool(config.costApi),
    createCostByServiceTool(config.costApi),
    createCostQueryTool(config.costApi),
    createBashTool(),
    createCloudCliTool(),
    createResourceListTool(),
    createResourceMetricsTool(),
    createOptimizationTool(config.costApi),
  ];
  for (const tool of tools) {
    toolRegistry.register(tool);
  }

  return createAgent({
    provider,
    conversation,
    toolRegistry,
    renderer,
    spinner,
    systemPrompt: buildSystemPrompt(config, toolRegistry.list()),
    maxIterations: config.agent.maxIterations,
    streamHandler: {
      onText(chunk: string) {
        spinner.stop();
        renderer.streamText(chunk);
      },
      onToolUse(_id: string, name: string, _input: Record<string, unknown>) {
        spinner.stop();
        renderer.endStream();
        void name;
      },
      onError(error: Error) {
        spinner.stop();
        renderer.endStream();
        renderer.error(error.message);
      },
    },
  });
}

export function handleSlashCommand(command: string, agent: Agent, renderer: Renderer): 'continue' | 'quit' {
  switch (command) {
    case '/quit':
    case '/exit':
    case '/q':
      return 'quit';

    case '/help':
    case '/h':
      renderer.help();
      return 'continue';

    case '/clear':
      agent.conversation.clear();
      renderer.success('Conversation cleared.');
      return 'continue';

    case '/history': {
      const history = agent.conversation.getHistory();
      if (history.length === 0) {
        renderer.info('No conversation history.');
      } else {
        renderer.newline();
        for (const entry of history) {
          renderer.info(`  ${entry.role}: ${entry.summary}`);
        }
        renderer.newline();
      }
      return 'continue';
    }

    case '/cost':
    case '/usage':
      renderer.usage(agent.usage);
      return 'continue';

    case '/model':
      renderer.newline();
      renderer.info(`  Provider: ${agent.providerName}`);
      renderer.info(`  Model:    ${agent.model}`);
      renderer.newline();
      return 'continue';

    default:
      renderer.warning(`Unknown command: ${command}. Type /help for available commands.`);
      return 'continue';
  }
}

// ──────────────── TUI mode (interactive TTY) ────────────────

async function runTUI(config: MasterMindConfig) {
  const { waitUntilExit } = render(createElement(App, { config }), { exitOnCtrlC: false });
  await waitUntilExit();
}

// ──────────────── Entry point ────────────────

async function main() {
  const config = loadConfig();
  await runTUI(config);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
