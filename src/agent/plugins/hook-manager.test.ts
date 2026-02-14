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
});
