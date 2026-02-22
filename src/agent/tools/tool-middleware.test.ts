import { test, expect, describe, spyOn } from 'bun:test';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { withLogging, withCache, composeMiddleware } from './tool-middleware';

function createStubTool(id = 'stub', result = { content: 'ok' }) {
  return createTool({
    id,
    description: `Stub tool ${id}`,
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ context }) => result,
  });
}

describe('withLogging', () => {
  test('preserves tool identity', () => {
    const tool = createStubTool('my-tool');
    const wrapped = withLogging(tool);
    expect(wrapped.id).toBe('my-tool');
    expect(wrapped.description).toBe('Stub tool my-tool');
    expect(wrapped.inputSchema).toBeDefined();
  });

  test('calls original execute and returns result', async () => {
    const result = { content: 'hello' };
    const tool = createStubTool('t1', result);
    const wrapped = withLogging(tool);
    const output = await wrapped.execute!({ query: 'test' } as any);
    expect(output).toEqual(result);
  });

  test('logs start and done to stderr', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const tool = createStubTool('logged');
    const wrapped = withLogging(tool);
    await wrapped.execute!({ query: 'q' } as any);

    const calls = spy.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('[tool:logged] start'))).toBe(true);
    expect(calls.some(c => c.includes('[tool:logged] done'))).toBe(true);
    spy.mockRestore();
  });

  test('logs error on failure and re-throws', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const tool = createTool({
      id: 'fail',
      description: 'fails',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => { throw new Error('boom'); },
    });
    const wrapped = withLogging(tool);
    await expect(wrapped.execute!({ query: 'q' } as any)).rejects.toThrow('boom');

    const calls = spy.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('[tool:fail] error'))).toBe(true);
    spy.mockRestore();
  });
});

describe('withCache', () => {
  test('returns cached result on second call with same input', async () => {
    let callCount = 0;
    const tool = createTool({
      id: 'counted',
      description: 'counts',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        callCount++;
        return { content: `call-${callCount}` };
      },
    });

    const wrapped = withCache(tool, 60_000);
    const r1 = await wrapped.execute!({ query: 'same' } as any);
    const r2 = await wrapped.execute!({ query: 'same' } as any);

    expect(r1).toEqual({ content: 'call-1' });
    expect(r2).toEqual({ content: 'call-1' }); // cached
    expect(callCount).toBe(1);
  });

  test('treats different inputs as separate cache keys', async () => {
    let callCount = 0;
    const tool = createTool({
      id: 'multi',
      description: 'multi',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        callCount++;
        return { content: `call-${callCount}` };
      },
    });

    const wrapped = withCache(tool, 60_000);
    await wrapped.execute!({ query: 'a' } as any);
    await wrapped.execute!({ query: 'b' } as any);

    expect(callCount).toBe(2);
  });

  test('expires after TTL', async () => {
    let callCount = 0;
    const tool = createTool({
      id: 'ttl',
      description: 'ttl',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        callCount++;
        return { content: `call-${callCount}` };
      },
    });

    // Use 0ms TTL so it expires immediately
    const wrapped = withCache(tool, 0);
    await wrapped.execute!({ query: 'x' } as any);
    await wrapped.execute!({ query: 'x' } as any);

    expect(callCount).toBe(2); // not cached
  });
});

describe('composeMiddleware', () => {
  test('applies wrappers left-to-right', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    let callCount = 0;
    const tool = createTool({
      id: 'composed',
      description: 'composed',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => {
        callCount++;
        return { content: 'ok' };
      },
    });

    const wrap = composeMiddleware(
      withLogging,
      (t) => withCache(t, 60_000),
    );
    const wrapped = wrap(tool);

    await wrapped.execute!({ query: 'test' } as any);
    await wrapped.execute!({ query: 'test' } as any);

    // Logging should fire twice (it wraps the cache), but execute only once (cached)
    expect(callCount).toBe(1);
    spy.mockRestore();
  });
});
