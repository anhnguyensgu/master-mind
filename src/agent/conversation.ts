export interface ConversationManager {
  addUserMessage(content: string): void;
  addAssistantMessage(content: string): void;
  getHistory(): Array<{ role: string; summary: string }>;
  clear(): void;
  messageCount(): number;
}

const MAX_MESSAGES = 100;

export function createConversationManager(): ConversationManager {
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  function truncateIfNeeded() {
    if (messages.length > MAX_MESSAGES) {
      const keep = Math.floor(MAX_MESSAGES * 0.75);
      messages = messages.slice(-keep);
    }
  }

  return {
    addUserMessage(content: string) {
      messages.push({ role: 'user', content });
      truncateIfNeeded();
    },

    addAssistantMessage(content: string) {
      messages.push({ role: 'assistant', content });
      truncateIfNeeded();
    },

    getHistory() {
      return messages.map((msg) => ({
        role: msg.role,
        summary: msg.content.slice(0, 100),
      }));
    },

    clear() {
      messages = [];
    },

    messageCount() {
      return messages.length;
    },
  };
}
