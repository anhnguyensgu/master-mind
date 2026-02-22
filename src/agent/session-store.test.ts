import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { createSessionStore, type SessionStore } from './session-store';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'os';

let store: SessionStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mm-test-'));
  store = createSessionStore(join(tmpDir, 'test.db'));
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('session store', () => {
  test('should create a session and return an id', () => {
    const id = store.createSession('anthropic', 'claude-3');
    expect(id).toBeString();
    expect(id.length).toBeGreaterThan(0);
  });

  test('should list sessions', () => {
    store.createSession('anthropic', 'claude-3');
    store.createSession('openai', 'gpt-4');

    const sessions = store.listSessions();
    expect(sessions.length).toBe(2);
    expect(sessions[0]!.model).toBe('gpt-4');
    expect(sessions[1]!.model).toBe('claude-3');
  });

  test('should save and retrieve messages', () => {
    const id = store.createSession('anthropic', 'claude-3');

    store.saveMessage(id, 'user', 'Hello');
    store.saveMessage(id, 'assistant', 'Hi there!');
    store.saveMessage(id, 'user', 'How are you?');

    const messages = store.getMessages(id);
    expect(messages.length).toBe(3);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    expect(messages[2]).toEqual({ role: 'user', content: 'How are you?' });
  });

  test('should return empty array for unknown session', () => {
    const messages = store.getMessages('nonexistent');
    expect(messages).toEqual([]);
  });

  test('should get most recent session id', () => {
    const id1 = store.createSession('anthropic', 'claude-3');
    const id2 = store.createSession('openai', 'gpt-4');

    // id2 is most recent since it was created last
    expect(store.getMostRecentSessionId()).toBe(id2);

    // After saving a message to id1, it becomes most recent
    store.saveMessage(id1, 'user', 'update');
    expect(store.getMostRecentSessionId()).toBe(id1);
  });

  test('should return null when no sessions exist', () => {
    expect(store.getMostRecentSessionId()).toBeNull();
  });

  test('should update session title', () => {
    const id = store.createSession('anthropic', 'claude-3');
    store.updateSessionTitle(id, 'My first conversation');

    const sessions = store.listSessions();
    expect(sessions[0]!.title).toBe('My first conversation');
  });

  test('should include message count in session list', () => {
    const id = store.createSession('anthropic', 'claude-3');
    store.saveMessage(id, 'user', 'Hello');
    store.saveMessage(id, 'assistant', 'Hi');
    store.saveMessage(id, 'user', 'Bye');

    const sessions = store.listSessions();
    expect(sessions[0]!.messageCount).toBe(3);
  });

  test('should respect limit when listing sessions', () => {
    for (let i = 0; i < 15; i++) {
      store.createSession('anthropic', `model-${i}`);
    }

    const sessions = store.listSessions(5);
    expect(sessions.length).toBe(5);
  });

  test('should keep messages isolated between sessions', () => {
    const id1 = store.createSession('anthropic', 'claude-3');
    const id2 = store.createSession('openai', 'gpt-4');

    store.saveMessage(id1, 'user', 'Hello from session 1');
    store.saveMessage(id2, 'user', 'Hello from session 2');

    const msgs1 = store.getMessages(id1);
    const msgs2 = store.getMessages(id2);

    expect(msgs1.length).toBe(1);
    expect(msgs1[0]!.content).toBe('Hello from session 1');
    expect(msgs2.length).toBe(1);
    expect(msgs2[0]!.content).toBe('Hello from session 2');
  });
});

describe('persistent conversation manager', () => {
  test('should auto-save messages through the conversation manager', async () => {
    const { createPersistentConversationManager } = await import('./conversation');

    const id = store.createSession('anthropic', 'claude-3');
    const conv = createPersistentConversationManager(store, id);

    conv.addUserMessage('Hello');
    conv.addAssistantMessage('Hi there!');

    // Verify messages were persisted
    const messages = store.getMessages(id);
    expect(messages.length).toBe(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  test('should set session title from first user message', async () => {
    const { createPersistentConversationManager } = await import('./conversation');

    const id = store.createSession('anthropic', 'claude-3');
    const conv = createPersistentConversationManager(store, id);

    conv.addUserMessage('Tell me about cloud costs');
    conv.addUserMessage('And also about scaling');

    const sessions = store.listSessions();
    expect(sessions[0]!.title).toBe('Tell me about cloud costs');
  });

  test('should initialize with existing messages when resuming', async () => {
    const { createPersistentConversationManager } = await import('./conversation');

    const id = store.createSession('anthropic', 'claude-3');
    store.saveMessage(id, 'user', 'Hello');
    store.saveMessage(id, 'assistant', 'Hi');

    const existingMessages = store.getMessages(id);
    const conv = createPersistentConversationManager(store, id, existingMessages);

    expect(conv.messageCount()).toBe(2);
    expect(conv.getMessages()).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]);

    // New messages should also be persisted
    conv.addUserMessage('How are you?');
    expect(store.getMessages(id).length).toBe(3);
  });

  test('should clear in-memory but preserve DB records', async () => {
    const { createPersistentConversationManager } = await import('./conversation');

    const id = store.createSession('anthropic', 'claude-3');
    const conv = createPersistentConversationManager(store, id);

    conv.addUserMessage('Hello');
    conv.addAssistantMessage('Hi');
    conv.clear();

    expect(conv.messageCount()).toBe(0);
    // DB still has the messages
    expect(store.getMessages(id).length).toBe(2);
  });
});
