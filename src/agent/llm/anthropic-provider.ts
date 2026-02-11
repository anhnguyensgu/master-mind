import type { LLMConfig } from '../../config/config.types';
import type {
  LLMProvider,
  LLMMessage,
  LLMToolDef,
  LLMResponse,
  LLMContentBlock,
  StreamCallbacks,
} from './llm.types';
import type { TokenUsage } from '../agent.types';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.maxTokens = config.maxTokens;

    if (!this.apiKey) {
      throw new Error('LLM_API_KEY is required for Anthropic provider');
    }
  }

  async streamMessage(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: LLMToolDef[],
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: this.convertMessages(messages),
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    return this.parseSSEStream(response, callbacks);
  }

  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  private convertMessages(messages: LLMMessage[]): unknown[] {
    return messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // Convert content blocks to Anthropic format
      const content = msg.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        }
        if (block.type === 'tool_use') {
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: block.tool_use_id,
            content: block.content,
            ...(block.is_error ? { is_error: true } : {}),
          };
        }
        return block;
      });

      return { role: msg.role, content };
    });
  }

  private async parseSSEStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const contentBlocks: LLMContentBlock[] = [];
    let stopReason: 'end' | 'tool_use' = 'end';
    let inputTokens = 0;
    let outputTokens = 0;

    // Track in-progress content blocks by index
    const blockMap = new Map<number, { type: string; id?: string; name?: string; text?: string; input?: string }>();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          const eventType = event.type as string;

          if (eventType === 'message_start') {
            const message = event.message as Record<string, unknown>;
            const usage = message.usage as Record<string, number> | undefined;
            if (usage) {
              inputTokens += usage.input_tokens || 0;
            }
          } else if (eventType === 'content_block_start') {
            const index = event.index as number;
            const block = event.content_block as Record<string, unknown>;
            blockMap.set(index, {
              type: block.type as string,
              id: block.id as string | undefined,
              name: block.name as string | undefined,
              text: '',
              input: '',
            });
          } else if (eventType === 'content_block_delta') {
            const index = event.index as number;
            const delta = event.delta as Record<string, unknown>;
            const tracked = blockMap.get(index);
            if (!tracked) continue;

            if (delta.type === 'text_delta') {
              const text = delta.text as string;
              tracked.text = (tracked.text || '') + text;
              callbacks.onText(text);
            } else if (delta.type === 'input_json_delta') {
              tracked.input = (tracked.input || '') + (delta.partial_json as string);
            }
          } else if (eventType === 'content_block_stop') {
            const index = event.index as number;
            const tracked = blockMap.get(index);
            if (!tracked) continue;

            if (tracked.type === 'text') {
              contentBlocks.push({ type: 'text', text: tracked.text || '' });
            } else if (tracked.type === 'tool_use') {
              let input: Record<string, unknown> = {};
              try {
                input = JSON.parse(tracked.input || '{}');
              } catch {
                // empty input
              }
              contentBlocks.push({
                type: 'tool_use',
                id: tracked.id || '',
                name: tracked.name || '',
                input,
              });
              callbacks.onToolUse(tracked.id || '', tracked.name || '', input);
            }
          } else if (eventType === 'message_delta') {
            const delta = event.delta as Record<string, unknown>;
            if (delta.stop_reason === 'tool_use') {
              stopReason = 'tool_use';
            }
            const usage = event.usage as Record<string, number> | undefined;
            if (usage) {
              outputTokens += usage.output_tokens || 0;
            }
          } else if (eventType === 'message_stop') {
            // Stream complete
          } else if (eventType === 'error') {
            const errorObj = event.error as Record<string, string>;
            callbacks.onError(new Error(errorObj.message || 'Unknown Anthropic stream error'));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    this.totalUsage.inputTokens += inputTokens;
    this.totalUsage.outputTokens += outputTokens;

    return {
      content: contentBlocks,
      stopReason,
      usage: { inputTokens, outputTokens },
    };
  }
}
