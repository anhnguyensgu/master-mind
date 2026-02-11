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

/**
 * OpenAI-compatible provider using raw fetch() + SSE parsing.
 * Works with: OpenAI, Azure OpenAI, Groq, Together, Fireworks, etc.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
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
      throw new Error('LLM_API_KEY is required for OpenAI provider');
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
      messages: this.convertMessages(messages, systemPrompt),
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    return this.parseSSEStream(response, callbacks);
  }

  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  private convertMessages(
    messages: LLMMessage[],
    systemPrompt: string,
  ): unknown[] {
    const result: unknown[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content });
        continue;
      }

      // Handle content blocks
      if (msg.role === 'assistant') {
        // Merge text and tool_use blocks into an assistant message
        const textParts = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');

        const toolCalls = msg.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => {
            const block = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
            return {
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            };
          });

        const assistantMsg: Record<string, unknown> = {
          role: 'assistant',
        };
        if (textParts) assistantMsg.content = textParts;
        if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;

        result.push(assistantMsg);
      } else if (msg.role === 'user') {
        // Handle tool_result blocks -> tool messages
        const toolResults = msg.content.filter((b) => b.type === 'tool_result');
        const textBlocks = msg.content.filter((b) => b.type === 'text');

        for (const block of toolResults) {
          const tr = block as { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
          result.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: tr.content,
          });
        }

        if (textBlocks.length > 0) {
          const text = textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('');
          result.push({ role: 'user', content: text });
        }
      }
    }

    return result;
  }

  private async parseSSEStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const contentBlocks: LLMContentBlock[] = [];
    let stopReason: 'end' | 'tool_use' = 'end';
    let inputTokens = 0;
    let outputTokens = 0;

    // Track tool calls being built up
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let textContent = '';

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

          // Handle usage info
          const usage = event.usage as Record<string, number> | undefined;
          if (usage) {
            inputTokens = usage.prompt_tokens || inputTokens;
            outputTokens = usage.completion_tokens || outputTokens;
          }

          const choices = event.choices as Array<Record<string, unknown>> | undefined;
          if (!choices || choices.length === 0) continue;

          const choice = choices[0]!;
          const delta = choice.delta as Record<string, unknown> | undefined;
          const finishReason = choice.finish_reason as string | null;

          if (delta) {
            // Text content
            if (delta.content) {
              const chunk = delta.content as string;
              textContent += chunk;
              callbacks.onText(chunk);
            }

            // Tool calls
            const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
            if (toolCalls) {
              for (const tc of toolCalls) {
                const index = tc.index as number;
                const fn = tc.function as Record<string, string> | undefined;

                if (!toolCallMap.has(index)) {
                  toolCallMap.set(index, {
                    id: (tc.id as string) || '',
                    name: fn?.name || '',
                    arguments: '',
                  });
                }

                const tracked = toolCallMap.get(index)!;
                if (tc.id) tracked.id = tc.id as string;
                if (fn?.name) tracked.name = fn.name;
                if (fn?.arguments) tracked.arguments += fn.arguments;
              }
            }
          }

          if (finishReason === 'tool_calls') {
            stopReason = 'tool_use';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Build content blocks
    if (textContent) {
      contentBlocks.push({ type: 'text', text: textContent });
    }

    for (const [, tc] of toolCallMap) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.arguments || '{}');
      } catch {
        // empty input
      }
      contentBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input,
      });
      callbacks.onToolUse(tc.id, tc.name, input);
      stopReason = 'tool_use';
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
