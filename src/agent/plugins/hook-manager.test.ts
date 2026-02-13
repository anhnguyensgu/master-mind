import { test, expect, describe } from 'bun:test';
import { createHookManager } from './hook-manager';
import { createToolRegistry } from '../tool-registry';
import type { MasterMindConfig } from '../../config/config.types';

const stubConfig: MasterMindConfig = {
  llm: { provider: 'mock', apiKey: '', model: 'mock-1.0', baseUrl: '', maxTokens: 100 },
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

    await hm.runOnInit({ config: stubConfig, toolRegistry: createToolRegistry() });
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

  test('beforeToolExecute pipeline transforms name and input', async () => {
    const hm = createHookManager();
    hm.register('upper', {
      beforeToolExecute: async (name, input) => ({
        name: name.toUpperCase(),
        input,
      }),
    });

    const result = await hm.runBeforeToolExecute('bash', { cmd: 'ls' });
    expect(result).toEqual({ name: 'BASH', input: { cmd: 'ls' } });
  });

  test('beforeToolExecute returns null on block and short-circuits', async () => {
    const hm = createHookManager();
    let hookCCalled = false;
    hm.register('a', { beforeToolExecute: async (name, input) => ({ name, input }) });
    hm.register('b', { beforeToolExecute: async () => null });
    hm.register('c', { beforeToolExecute: async (name, input) => { hookCCalled = true; return { name, input }; } });

    const result = await hm.runBeforeToolExecute('bash', {});
    expect(result).toBeNull();
    expect(hookCCalled).toBe(false);
  });

  test('afterToolExecute pipeline transforms result', async () => {
    const hm = createHookManager();
    hm.register('redact', {
      afterToolExecute: async (_name, _input, result) => ({
        content: result.content + ' [redacted]',
        isError: result.isError,
      }),
    });

    const result = await hm.runAfterToolExecute('bash', {}, { content: 'secret' });
    expect(result).toEqual({ content: 'secret [redacted]', isError: undefined });
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
    expect(await hm.runBeforeToolExecute('x', { k: 1 })).toEqual({ name: 'x', input: { k: 1 } });
    expect(await hm.runAfterToolExecute('x', {}, { content: 'ok' })).toEqual({ content: 'ok' });
  });
});
