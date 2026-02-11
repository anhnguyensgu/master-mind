import type { TokenUsage } from './agent.types';
import type { LLMContentBlock, LLMToolUseBlock, LLMProvider, StreamCallbacks } from './llm/llm.types';
import type { Renderer } from '../cli/renderer';
import type { Spinner } from '../cli/spinner';
import type { ConversationManager } from './conversation';
import type { ToolRegistry } from './tool-registry';

export interface Agent {
  handleMessage(input: string): Promise<void>;
  readonly usage: TokenUsage;
  readonly conversation: ConversationManager;
  readonly providerName: string;
  readonly model: string;
}

async function runToolUseLoop(
  assistantContent: LLMContentBlock[],
  renderer: Renderer,
  toolRegistry: ToolRegistry,
  conversation: ConversationManager,
): Promise<void> {
  const toolUseBlocks = assistantContent.filter(
    (b): b is LLMToolUseBlock => b.type === 'tool_use',
  );

  if (toolUseBlocks.length === 0) return;

  const toolResults: LLMContentBlock[] = [];

  for (const toolUse of toolUseBlocks) {
    renderer.toolStart(toolUse.name, toolUse.input);
    const startTime = Date.now();

    const result = await toolRegistry.execute(toolUse.name, toolUse.input);
    const duration = Date.now() - startTime;

    if (result.isError) {
      renderer.toolError(toolUse.name, result.content);
    } else {
      renderer.toolEnd(toolUse.name, duration);
    }

    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: result.content,
      is_error: result.isError,
    });
  }

  conversation.addToolResults(toolResults);
}

export interface AgentDeps {
  provider: LLMProvider;
  conversation: ConversationManager;
  toolRegistry: ToolRegistry;
  renderer: Renderer;
  spinner: Spinner;
  streamHandler: StreamCallbacks;
  systemPrompt: string;
  maxIterations: number;
}

export function createAgent(deps: AgentDeps): Agent {
  const { provider, conversation, toolRegistry, renderer, spinner, streamHandler, systemPrompt, maxIterations } = deps;

  return {
    async handleMessage(input: string) {
      conversation.addUserMessage(input);
      spinner.start('Thinking...');

      let iterations = 0;

      try {
        while (iterations < maxIterations) {
          iterations++;

          const response = await provider.streamMessage(
            conversation.getMessages(),
            systemPrompt,
            toolRegistry.getLLMTools(),
            streamHandler,
          );

          renderer.endStream();
          conversation.addAssistantMessage(response.content);

          // If the model didn't request tool use, we're done
          if (response.stopReason !== 'tool_use') {
            break;
          }

          // Execute tools and continue the loop
          spinner.start('Running tools...');
          await runToolUseLoop(response.content, renderer, toolRegistry, conversation);
          spinner.start('Thinking...');
        }

        if (iterations >= maxIterations) {
          renderer.warning(`\nReached maximum iterations (${maxIterations}). Stopping.`);
        }
      } catch (error) {
        spinner.stop();
        renderer.endStream();
        const message = error instanceof Error ? error.message : String(error);
        renderer.error(message);
      }
    },

    get usage() {
      return provider.getUsage();
    },
    conversation,
    providerName: provider.name,
    model: provider.model,
  };
}
