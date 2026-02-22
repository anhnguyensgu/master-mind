import type { SessionStore } from './session-store';

export interface ConversationManager {
  addUserMessage(content: string): void;
  addAssistantMessage(content: string): void;
  getHistory(): Array<{ role: string; summary: string }>;
  getMessages(): Array<{ role: 'user' | 'assistant'; content: string }>;
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

    getMessages() {
      return [...messages];
    },

    clear() {
      messages = [];
    },

    messageCount() {
      return messages.length;
    },
  };
}

export function createPersistentConversationManager(
  sessionStore: SessionStore,
  sessionId: string,
  initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>,
): ConversationManager {
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = initialMessages ? [...initialMessages] : [];
  let hasSetTitle = initialMessages ? initialMessages.length > 0 : false;

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
      sessionStore.saveMessage(sessionId, 'user', content);
      if (!hasSetTitle) {
        sessionStore.updateSessionTitle(sessionId, content.slice(0, 80));
        hasSetTitle = true;
      }
    },

    addAssistantMessage(content: string) {
      messages.push({ role: 'assistant', content });
      truncateIfNeeded();
      sessionStore.saveMessage(sessionId, 'assistant', content);
    },

    getHistory() {
      return messages.map((msg) => ({
        role: msg.role,
        summary: msg.content.slice(0, 100),
      }));
    },

    getMessages() {
      return [...messages];
    },

    clear() {
      messages = [];
    },

    messageCount() {
      return messages.length;
    },
  };
}
