import { test, expect, describe } from 'bun:test';
import { createConversationManager } from './conversation';
import { createToolRegistry } from './tool-registry';
import { buildSystemPrompt } from './system-prompt';
import { createLLMProvider } from './llm/llm-factory';
import { loadConfig } from '../config/config';
import type { AgentTool } from './agent.types';
import type { MasterMindConfig } from '../config/config.types';

describe('conversation manager', () => {
  test('should create empty conversation', () => {
    const conv = createConversationManager();
    expect(conv.messageCount()).toBe(0);
    expect(conv.getMessages()).toEqual([]);
  });

  test('should add user messages', () => {
    const conv = createConversationManager();
    conv.addUserMessage('hello');
    expect(conv.messageCount()).toBe(1);
    expect(conv.getMessages()[0]).toEqual({ role: 'user', content: 'hello' });
  });

  test('should add assistant messages with content blocks', () => {
    const conv = createConversationManager();
    conv.addAssistantMessage([{ type: 'text', text: 'hi there' }]);
    expect(conv.messageCount()).toBe(1);
    const msg = conv.getMessages()[0]!;
    expect(msg.role).toBe('assistant');
    expect(Array.isArray(msg.content)).toBe(true);
  });

  test('should add tool results', () => {
    const conv = createConversationManager();
    conv.addToolResults([
      { type: 'tool_result', tool_use_id: 'test-1', content: 'result data' },
    ]);
    expect(conv.messageCount()).toBe(1);
    const msg = conv.getMessages()[0]!;
    expect(msg.role).toBe('user');
  });

  test('should clear conversation', () => {
    const conv = createConversationManager();
    conv.addUserMessage('hello');
    conv.addAssistantMessage([{ type: 'text', text: 'hi' }]);
    expect(conv.messageCount()).toBe(2);
    conv.clear();
    expect(conv.messageCount()).toBe(0);
  });

  test('should return a copy of messages', () => {
    const conv = createConversationManager();
    conv.addUserMessage('hello');
    const msgs1 = conv.getMessages();
    const msgs2 = conv.getMessages();
    expect(msgs1).not.toBe(msgs2); // different arrays
    expect(msgs1).toEqual(msgs2); // same content
  });

  test('should provide history summaries', () => {
    const conv = createConversationManager();
    conv.addUserMessage('what are my costs?');
    conv.addAssistantMessage([
      { type: 'text', text: 'Let me check that for you.' },
      { type: 'tool_use', id: 't1', name: 'cost_summary', input: {} },
    ]);
    const history = conv.getHistory();
    expect(history.length).toBe(2);
    expect(history[0]!.role).toBe('user');
    expect(history[0]!.summary).toContain('what are my costs?');
    expect(history[1]!.role).toBe('assistant');
    expect(history[1]!.summary).toContain('1 tool call');
  });

  test('should truncate at max messages', () => {
    const conv = createConversationManager();
    for (let i = 0; i < 120; i++) {
      conv.addUserMessage(`message ${i}`);
    }
    // Should be truncated to 75% of max (100)
    expect(conv.messageCount()).toBeLessThanOrEqual(100);
  });
});

describe('tool registry', () => {
  function createMockTool(name: string): AgentTool {
    return {
      name,
      description: `Mock tool: ${name}`,
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
      async execute(input) {
        return { content: `Executed ${name} with ${JSON.stringify(input)}` };
      },
    };
  }

  test('should register and list tools', () => {
    const registry = createToolRegistry();
    registry.register(createMockTool('tool_a'));
    registry.register(createMockTool('tool_b'));
    expect(registry.list()).toEqual(['tool_a', 'tool_b']);
  });

  test('should check if tool exists', () => {
    const registry = createToolRegistry();
    registry.register(createMockTool('tool_a'));
    expect(registry.has('tool_a')).toBe(true);
    expect(registry.has('tool_x')).toBe(false);
  });

  test('should convert tools to LLM format', () => {
    const registry = createToolRegistry();
    registry.register(createMockTool('tool_a'));
    const llmTools = registry.getLLMTools();
    expect(llmTools.length).toBe(1);
    expect(llmTools[0]!.name).toBe('tool_a');
    expect(llmTools[0]!.description).toBe('Mock tool: tool_a');
    expect(llmTools[0]!.input_schema).toBeDefined();
  });

  test('should execute registered tool', async () => {
    const registry = createToolRegistry();
    registry.register(createMockTool('tool_a'));
    const result = await registry.execute('tool_a', { input: 'test' });
    expect(result.content).toContain('Executed tool_a');
    expect(result.isError).toBeUndefined();
  });

  test('should return error for unknown tool', async () => {
    const registry = createToolRegistry();
    const result = await registry.execute('nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Unknown tool');
  });

  test('should catch tool execution errors', async () => {
    const registry = createToolRegistry();
    registry.register({
      name: 'failing_tool',
      description: 'A tool that fails',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        throw new Error('boom');
      },
    });
    const result = await registry.execute('failing_tool', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });
});

describe('system prompt', () => {
  test('should build a non-empty system prompt', () => {
    const config: MasterMindConfig = {
      llm: { provider: 'anthropic', apiKey: '', model: 'test', baseUrl: '', maxTokens: 1000 },
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
      llm: { provider: 'anthropic', apiKey: '', model: 'test', baseUrl: '', maxTokens: 1000 },
      costApi: { baseUrl: 'http://localhost:3000', token: '', defaultProvider: 'aws' },
      agent: { maxIterations: 10 },
    };
    const prompt = buildSystemPrompt(config, []);
    const today = new Date().toISOString().split('T')[0]!;
    expect(prompt).toContain(today);
  });
});

describe('LLM factory', () => {
  test('should throw for unknown provider', () => {
    expect(() => {
      createLLMProvider({
        provider: 'unknown' as any,
        apiKey: 'test',
        model: 'test',
        baseUrl: 'http://test',
        maxTokens: 1000,
      });
    }).toThrow('Unknown LLM provider');
  });

  test('should create anthropic provider', () => {
    const provider = createLLMProvider({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
      baseUrl: 'https://api.anthropic.com',
      maxTokens: 4096,
    });
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-4-5-20250929');
  });

  test('should create openai provider', () => {
    const provider = createLLMProvider({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      maxTokens: 4096,
    });
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-4o');
  });

  test('should create ollama provider', () => {
    const provider = createLLMProvider({
      provider: 'ollama',
      apiKey: '',
      model: 'llama3',
      baseUrl: 'http://localhost:11434',
      maxTokens: 4096,
    });
    expect(provider.name).toBe('ollama');
    expect(provider.model).toBe('llama3');
  });

  test('anthropic provider should throw without API key', () => {
    expect(() => {
      createLLMProvider({
        provider: 'anthropic',
        apiKey: '',
        model: 'test',
        baseUrl: 'https://api.anthropic.com',
        maxTokens: 1000,
      });
    }).toThrow('LLM_API_KEY is required');
  });

  test('openai provider should throw without API key', () => {
    expect(() => {
      createLLMProvider({
        provider: 'openai',
        apiKey: '',
        model: 'test',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 1000,
      });
    }).toThrow('LLM_API_KEY is required');
  });

  test('providers should track usage', () => {
    const provider = createLLMProvider({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'test',
      baseUrl: 'https://api.anthropic.com',
      maxTokens: 1000,
    });
    const usage = provider.getUsage();
    expect(usage.inputTokens).toBe(0);
    expect(usage.outputTokens).toBe(0);
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
