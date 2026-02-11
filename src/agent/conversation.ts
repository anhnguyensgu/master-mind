import type { LLMMessage, LLMContentBlock } from './llm/llm.types';

export interface ConversationManager {
  addUserMessage(content: string): void;
  addAssistantMessage(content: LLMContentBlock[]): void;
  addToolResults(results: LLMContentBlock[]): void;
  getMessages(): LLMMessage[];
  getHistory(): Array<{ role: string; summary: string }>;
  clear(): void;
  messageCount(): number;
}

const MAX_MESSAGES = 100;

export function createConversationManager(): ConversationManager {
  let messages: LLMMessage[] = [];

  function truncateIfNeeded() {
    if (messages.length > MAX_MESSAGES) {
      // Keep the first message (context) and the most recent messages
      const keep = Math.floor(MAX_MESSAGES * 0.75);
      messages = messages.slice(-keep);
    }
  }

  return {
    addUserMessage(content: string) {
      messages.push({ role: 'user', content });
      truncateIfNeeded();
    },

    addAssistantMessage(content: LLMContentBlock[]) {
      messages.push({ role: 'assistant', content });
      truncateIfNeeded();
    },

    addToolResults(results: LLMContentBlock[]) {
      messages.push({ role: 'user', content: results });
      truncateIfNeeded();
    },

    getMessages(): LLMMessage[] {
      return [...messages];
    },

    getHistory(): Array<{ role: string; summary: string }> {
      return messages.map((msg) => {
        if (typeof msg.content === 'string') {
          return { role: msg.role, summary: msg.content.slice(0, 100) };
        }
        const textBlocks = msg.content.filter((b) => b.type === 'text');
        const toolBlocks = msg.content.filter((b) => b.type === 'tool_use');
        const resultBlocks = msg.content.filter((b) => b.type === 'tool_result');

        let summary = '';
        if (textBlocks.length > 0) {
          summary = (textBlocks[0] as { type: 'text'; text: string }).text.slice(0, 100);
        }
        if (toolBlocks.length > 0) {
          summary += ` [${toolBlocks.length} tool call(s)]`;
        }
        if (resultBlocks.length > 0) {
          summary += ` [${resultBlocks.length} tool result(s)]`;
        }
        return { role: msg.role, summary: summary.trim() };
      });
    },

    clear() {
      messages = [];
    },

    messageCount() {
      return messages.length;
    },
  };
}
