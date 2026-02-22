import { test, expect, describe } from 'bun:test';
import { createHookManager } from './hook-manager';
import type { MasterMindConfig } from '../../config/config.types';

const stubConfig: MasterMindConfig = {
  llm: { provider: 'mock',  model: 'mock-1.0', baseUrl: '', maxTokens: 100 },
  costApi: { baseUrl: '', token: '', defaultProvider: 'aws' },
  agent: { maxIterations: 1 },
};

describe('hook manager', () => {
  test('beforeMessage pipeline runs in order', async () => {
    const hm = createHookManager();
    hm.register('a', { beforeMessage: async (m) => m + ' [A]' });
    hm.register('b', { beforeMessage: async (m) => m + ' [B]' });

    const result = await hm.runBeforeMessage('hello');
    expect(result).toBe('hello [A] [B]');
  });

  test('onInit runs in registration order', async () => {
    const hm = createHookManager();
    const order: string[] = [];
    hm.register('a', { onInit: async () => { order.push('a'); } });
    hm.register('b', { onInit: async () => { order.push('b'); } });

    await hm.runOnInit({ config: stubConfig });
    expect(order).toEqual(['a', 'b']);
  });

  test('onShutdown runs in LIFO order', async () => {
    const hm = createHookManager();
    const order: string[] = [];
    hm.register('a', { onShutdown: async () => { order.push('a'); } });
    hm.register('b', { onShutdown: async () => { order.push('b'); } });

    await hm.runOnShutdown();
    expect(order).toEqual(['b', 'a']);
  });

  test('onShutdown continues after one plugin throws', async () => {
    const hm = createHookManager();
    const order: string[] = [];
    hm.register('a', { onShutdown: async () => { order.push('a'); } });
    hm.register('b', { onShutdown: async () => { throw new Error('boom'); } });

    await hm.runOnShutdown();
    expect(order).toEqual(['a']);
  });

  test('afterResponse fan-out calls all hooks', async () => {
    const hm = createHookManager();
    const seen: string[] = [];
    hm.register('a', { afterResponse: async (r) => { seen.push(`a:${r.content}`); } });
    hm.register('b', { afterResponse: async (r) => { seen.push(`b:${r.content}`); } });

    await hm.runAfterResponse({ content: 'hi', stopReason: 'end' });
    expect(seen).toEqual(['a:hi', 'b:hi']);
  });

  test('no hooks registered returns input unchanged', async () => {
    const hm = createHookManager();
    expect(await hm.runBeforeMessage('hi')).toBe('hi');
  });

  test('runBeforeToolCall passes event through all plugins', async () => {
    const hm = createHookManager();
    hm.register('a', {
      beforeToolCall: async (e) => ({ ...e, args: { ...e.args, addedByA: true } }),
    });
    hm.register('b', {
      beforeToolCall: async (e) => ({ ...e, args: { ...e.args, addedByB: true } }),
    });

    const result = await hm.runBeforeToolCall({
      toolName: 'bash', toolCallId: 'tc1', args: { command: 'ls' },
    });
    expect(result).not.toBeNull();
    expect(result!.args).toEqual({ command: 'ls', addedByA: true, addedByB: true });
  });

  test('runBeforeToolCall returns null when plugin vetoes', async () => {
    const hm = createHookManager();
    hm.register('veto', { beforeToolCall: async () => null });

    const result = await hm.runBeforeToolCall({
      toolName: 'bash', toolCallId: 'tc1', args: {},
    });
    expect(result).toBeNull();
  });

  test('runBeforeToolCall stops pipeline after veto', async () => {
    const hm = createHookManager();
    const called: string[] = [];
    hm.register('veto', {
      beforeToolCall: async () => { called.push('veto'); return null; },
    });
    hm.register('after', {
      beforeToolCall: async (e) => { called.push('after'); return e; },
    });

    await hm.runBeforeToolCall({ toolName: 'x', toolCallId: 'tc1', args: {} });
    expect(called).toEqual(['veto']); // 'after' was NOT called
  });

  test('runAfterToolResult transforms result', async () => {
    const hm = createHookManager();
    hm.register('redact', {
      afterToolResult: async (e) => ({
        ...e,
        result: { content: e.result.content.replace('secret', '***'), isError: e.result.isError },
      }),
    });

    const result = await hm.runAfterToolResult({
      toolName: 'bash', toolCallId: 'tc1',
      result: { content: 'the secret is here', isError: false },
      durationMs: 100,
    });
    expect(result.result.content).toBe('the *** is here');
  });

  test('runAfterToolResult chains multiple plugins', async () => {
    const hm = createHookManager();
    hm.register('a', {
      afterToolResult: async (e) => ({
        ...e, result: { content: e.result.content + ' [A]', isError: e.result.isError },
      }),
    });
    hm.register('b', {
      afterToolResult: async (e) => ({
        ...e, result: { content: e.result.content + ' [B]', isError: e.result.isError },
      }),
    });

    const result = await hm.runAfterToolResult({
      toolName: 'x', toolCallId: 'tc1',
      result: { content: 'data', isError: false },
      durationMs: 50,
    });
    expect(result.result.content).toBe('data [A] [B]');
  });

  test('runBeforeToolCall returns event unchanged when no hooks', async () => {
    const hm = createHookManager();
    const event = { toolName: 'x', toolCallId: 'tc1', args: { a: 1 } };
    const result = await hm.runBeforeToolCall(event);
    expect(result).toEqual(event);
  });

  test('runAfterToolResult returns event unchanged when no hooks', async () => {
    const hm = createHookManager();
    const event = {
      toolName: 'x', toolCallId: 'tc1',
      result: { content: 'ok', isError: false },
      durationMs: 10,
    };
    const result = await hm.runAfterToolResult(event);
    expect(result).toEqual(event);
  });
});
