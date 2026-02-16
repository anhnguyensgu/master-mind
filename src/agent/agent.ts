import { Agent as MastraAgent } from '@mastra/core/agent';
import type { HookManager } from './plugins/hook-manager';
import type { ConversationManager } from './conversation';
import type { ChatItem } from '../shared/stream/chatItems';
import { createStreamParser } from '../shared/stream/streamParser';
import { CHAT_ITEM_TYPE } from '../shared/stream/chatItems';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** The only contract between agent and the UI — a simple event publisher */
export interface AgentEventHandler {
  onItem(item: ChatItem): void;
  onStreamDelta(text: string): void;
}

export class Agent {
  private mastraAgent: MastraAgent;
  private messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  conversation: ConversationManager;
  eventHandler: AgentEventHandler;
  providerName: string;
  model: string;
  hookManager?: HookManager;

  constructor(
    mastraAgent: MastraAgent,
    conversation: ConversationManager,
    eventHandler: AgentEventHandler,
    providerName: string,
    model: string,
    hookManager?: HookManager,
  ) {
    this.mastraAgent = mastraAgent;
    this.conversation = conversation;
    this.eventHandler = eventHandler;
    this.providerName = providerName;
    this.model = model;
    this.hookManager = hookManager;
  }

  get usage(): TokenUsage {
    return this.totalUsage;
  }

  async handleMessage(input: string): Promise<void> {
    const processedInput = this.hookManager
      ? await this.hookManager.runBeforeMessage(input)
      : input;

    this.conversation.addUserMessage(processedInput);
    this.messages.push({ role: 'user', content: processedInput });

    const parser = createStreamParser((item) => this.eventHandler.onItem(item));

    try {
      const output = await this.mastraAgent.stream(this.messages);
      const toolStartTimes = new Map<string, number>();

      for await (const chunk of output.fullStream) {
        switch (chunk.type) {
          case 'text-delta':
            parser.feed(chunk?.payload.text);
            this.eventHandler.onStreamDelta(parser.getCurrentLine());
            break;

          case 'tool-call':
            parser.flush();
            this.eventHandler.onStreamDelta('');
            toolStartTimes.set(chunk.payload.toolCallId, Date.now());
            {
              const inputStr = JSON.stringify(chunk.payload.args, null, 0);
              const truncated = inputStr.length > 100 ? inputStr.slice(0, 97) + '...' : inputStr;
              this.eventHandler.onItem({
                type: CHAT_ITEM_TYPE.TOOL_START,
                name: chunk.payload.toolName,
                input: truncated,
              });
            }
            break;

          case 'tool-result':
            {
              const startTime = toolStartTimes.get(chunk.payload.toolCallId);
              const duration = startTime ? Date.now() - startTime : 0;
              toolStartTimes.delete(chunk.payload.toolCallId);

              const result = chunk.payload.result as { content?: string; isError?: boolean } | undefined;
              const content = typeof result?.content === 'string' ? result.content : '';
              const truncatedResult = content.length > 500 ? content.slice(0, 497) + '...' : content;

              if (result?.isError) {
                this.eventHandler.onItem({
                  type: CHAT_ITEM_TYPE.TOOL_ERROR,
                  name: chunk.payload.toolName,
                  error: content || String(chunk.payload.result),
                });
              } else {
                this.eventHandler.onItem({
                  type: CHAT_ITEM_TYPE.TOOL_END,
                  name: chunk.payload.toolName,
                  durationMs: duration,
                  result: truncatedResult,
                });
              }
            }
            break;

          case 'error':
            parser.flush();
            this.eventHandler.onStreamDelta('');
            this.eventHandler.onItem({
              type: CHAT_ITEM_TYPE.ERROR,
              message: String(chunk.payload.error),
            });
            break;
        }
      }

      // Flush remaining text
      parser.flush();
      this.eventHandler.onStreamDelta('');

      // Accumulate usage
      const usage = await output.usage;
      this.totalUsage.inputTokens += usage.inputTokens ?? 0;
      this.totalUsage.outputTokens += usage.outputTokens ?? 0;

      // Accumulate assistant response for multi-turn
      const text = await output.text;
      if (text) {
        this.messages.push({ role: 'assistant', content: text });
        this.conversation.addAssistantMessage(text);
      }

      // Run afterResponse hook
      if (this.hookManager) {
        const finishReason = await output.finishReason;
        await this.hookManager.runAfterResponse({ content: text, stopReason: finishReason ?? 'end' });
      }
    } catch (error) {
      parser.flush();
      this.eventHandler.onStreamDelta('');
      const message = error instanceof Error ? error.message : String(error);
      this.eventHandler.onItem({ type: CHAT_ITEM_TYPE.ERROR, message: `error from stream ${message}` });
    }
  }
}
