import { loadConfig } from '../config/config';
import { createAgent } from '../agent/agent';
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
import { createRenderer } from './renderer';
import { createInputHandler } from './input';
import { createSpinner } from './spinner';
import { theme, colors } from './theme';

async function main() {
  const config = loadConfig();
  const renderer = createRenderer();
  const input = createInputHandler();
  const spinner = createSpinner();

  renderer.banner();

  // Show model info
  const providerLabel = config.llm.provider;
  const modelLabel = config.llm.model;
  renderer.info(`  Provider: ${providerLabel} | Model: ${modelLabel}`);
  renderer.newline();

  let agent;
  try {
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

    agent = createAgent({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderer.error(`Failed to initialize agent: ${message}`);
    input.close();
    process.exit(1);
  }

  // REPL loop
  while (true) {
    let userInput: string;
    try {
      userInput = await input.prompt();
    } catch {
      // EOF or input closed (e.g. Ctrl+D)
      break;
    }

    if (!userInput) continue;

    // Slash commands
    if (userInput.startsWith('/')) {
      const command = userInput.split(' ')[0]!.toLowerCase();

      switch (command) {
        case '/quit':
        case '/exit':
        case '/q':
          renderer.info('Goodbye!');
          input.close();
          process.exit(0);
          break;

        case '/help':
        case '/h':
          renderer.help();
          continue;

        case '/clear':
          agent.conversation.clear();
          renderer.success('Conversation cleared.');
          continue;

        case '/history': {
          const history = agent.conversation.getHistory();
          if (history.length === 0) {
            renderer.info('No conversation history.');
          } else {
            renderer.newline();
            for (const entry of history) {
              const roleColor = entry.role === 'user' ? theme.prompt : theme.assistant;
              process.stdout.write(
                `  ${roleColor}${entry.role}${colors.reset}: ${entry.summary}\n`,
              );
            }
            renderer.newline();
          }
          continue;
        }

        case '/cost':
        case '/usage': {
          const usage = agent.usage;
          renderer.usage(usage);
          continue;
        }

        case '/model': {
          renderer.newline();
          renderer.info(`  Provider: ${agent.providerName}`);
          renderer.info(`  Model:    ${agent.model}`);
          renderer.newline();
          continue;
        }

        default:
          renderer.warning(`Unknown command: ${command}. Type /help for available commands.`);
          continue;
      }
    }

    // Send to agent
    await agent.handleMessage(userInput);
    renderer.newline();
  }

  input.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
