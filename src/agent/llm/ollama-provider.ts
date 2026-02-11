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
 * Ollama provider using /api/chat endpoint with NDJSON streaming.
 * Works with local models: llama3, mistral, deepseek, codellama, etc.
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly model: string;
  private baseUrl: string;
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(config: LLMConfig) {
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async streamMessage(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: LLMToolDef[],
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: this.convertMessages(messages, systemPrompt),
      stream: true,
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

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    return this.parseNDJSONStream(response, callbacks);
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

      if (msg.role === 'assistant') {
        const textParts = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');

        const toolCalls = msg.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => {
            const block = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
            return {
              function: {
                name: block.name,
                arguments: block.input,
              },
            };
          });

        const assistantMsg: Record<string, unknown> = {
          role: 'assistant',
          content: textParts || '',
        };
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }
        result.push(assistantMsg);
      } else if (msg.role === 'user') {
        const toolResults = msg.content.filter((b) => b.type === 'tool_result');
        const textBlocks = msg.content.filter((b) => b.type === 'text');

        for (const block of toolResults) {
          const tr = block as { type: 'tool_result'; tool_use_id: string; content: string };
          result.push({
            role: 'tool',
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

  private async parseNDJSONStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const contentBlocks: LLMContentBlock[] = [];
    let stopReason: 'end' | 'tool_use' = 'end';
    let textContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

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
          if (!line.trim()) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          const message = event.message as Record<string, unknown> | undefined;

          if (message) {
            // Text content
            if (message.content) {
              const chunk = message.content as string;
              textContent += chunk;
              callbacks.onText(chunk);
            }

            // Tool calls
            const toolCalls = message.tool_calls as Array<Record<string, unknown>> | undefined;
            if (toolCalls) {
              for (const tc of toolCalls) {
                const fn = tc.function as Record<string, unknown>;
                const name = fn.name as string;
                const input = (fn.arguments as Record<string, unknown>) || {};
                const id = `ollama-${Date.now()}-${name}`;

                contentBlocks.push({
                  type: 'tool_use',
                  id,
                  name,
                  input,
                });
                callbacks.onToolUse(id, name, input);
                stopReason = 'tool_use';
              }
            }
          }

          // Check for done flag with token counts
          if (event.done === true) {
            promptTokens = (event.prompt_eval_count as number) || 0;
            completionTokens = (event.eval_count as number) || 0;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (textContent) {
      contentBlocks.unshift({ type: 'text', text: textContent });
    }

    this.totalUsage.inputTokens += promptTokens;
    this.totalUsage.outputTokens += completionTokens;

    return {
      content: contentBlocks,
      stopReason,
      usage: { inputTokens: promptTokens, outputTokens: completionTokens },
    };
  }
}
