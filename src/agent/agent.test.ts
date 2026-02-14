import { test, expect, describe } from 'bun:test';
import { createConversationManager } from './conversation';
import { buildSystemPrompt } from './system-prompt';
import { loadConfig } from '../config/config';
import type { MasterMindConfig } from '../config/config.types';

describe('conversation manager', () => {
  test('should create empty conversation', () => {
    const conv = createConversationManager();
    expect(conv.messageCount()).toBe(0);
  });

  test('should add user messages', () => {
    const conv = createConversationManager();
    conv.addUserMessage('hello');
    expect(conv.messageCount()).toBe(1);
    const history = conv.getHistory();
    expect(history[0]).toEqual({ role: 'user', summary: 'hello' });
  });

  test('should add assistant messages', () => {
    const conv = createConversationManager();
    conv.addAssistantMessage('hi there');
    expect(conv.messageCount()).toBe(1);
    const history = conv.getHistory();
    expect(history[0]!.role).toBe('assistant');
    expect(history[0]!.summary).toBe('hi there');
  });

  test('should clear conversation', () => {
    const conv = createConversationManager();
    conv.addUserMessage('hello');
    conv.addAssistantMessage('hi');
    expect(conv.messageCount()).toBe(2);
    conv.clear();
    expect(conv.messageCount()).toBe(0);
  });

  test('should provide history summaries truncated to 100 chars', () => {
    const conv = createConversationManager();
    const longMessage = 'a'.repeat(200);
    conv.addUserMessage(longMessage);
    const history = conv.getHistory();
    expect(history[0]!.summary.length).toBe(100);
  });

  test('should truncate at max messages', () => {
    const conv = createConversationManager();
    for (let i = 0; i < 120; i++) {
      conv.addUserMessage(`message ${i}`);
    }
    expect(conv.messageCount()).toBeLessThanOrEqual(100);
  });
});

describe('system prompt', () => {
  test('should build a non-empty system prompt', () => {
    const config: MasterMindConfig = {
      llm: { provider: 'anthropic',  model: 'test', baseUrl: '', maxTokens: 1000 },
      costApi: { baseUrl: 'http://localhost:3000', token: '', defaultProvider: 'aws' },
      agent: { maxIterations: 10 },
    };
    const prompt = buildSystemPrompt(config, ['cost_summary', 'bash']);
    expect(prompt).toContain('Master Mind');
    expect(prompt).toContain('cost_summary');
    expect(prompt).toContain('bash');
    expect(prompt).toContain('aws');
    expect(prompt).toContain('http://localhost:3000');
  });

  test('should include current date', () => {
    const config: MasterMindConfig = {
      llm: { provider: 'anthropic',  model: 'test', baseUrl: '', maxTokens: 1000 },
      costApi: { baseUrl: 'http://localhost:3000', token: '', defaultProvider: 'aws' },
      agent: { maxIterations: 10 },
    };
    const prompt = buildSystemPrompt(config, []);
    const today = new Date().toISOString().split('T')[0]!;
    expect(prompt).toContain(today);
  });
});

describe('config', () => {
  test('should load config with defaults', () => {
    const config = loadConfig();
    expect(config.llm).toBeDefined();
    expect(config.costApi).toBeDefined();
    expect(config.agent).toBeDefined();
    expect(config.agent.maxIterations).toBe(10);
    expect(config.costApi.baseUrl).toBe('http://localhost:3000');
  });
});
