import { test, expect, describe, afterAll } from 'bun:test';
import { resolve } from 'node:path';
import { loadPlugins } from './plugin-loader';
import { createHookManager } from './hook-manager';
import { createToolRegistry } from '../tool-registry';
import type { MasterMindConfig } from '../../config/config.types';

const tmpDir = resolve(import.meta.dir, '__test_fixtures__');

async function writeTmpFile(name: string, content: string): Promise<string> {
  const filePath = resolve(tmpDir, name);
  await Bun.write(filePath, content);
  return filePath;
}

afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(tmpDir, { recursive: true, force: true });
});

const stubConfig: MasterMindConfig = {
  llm: { provider: 'mock', apiKey: '', model: 'mock-1.0', baseUrl: '', maxTokens: 100 },
  costApi: { baseUrl: '', token: '', defaultProvider: 'aws' },
  agent: { maxIterations: 1 },
};

// ---------------------------------------------------------------------------
// loadPlugins
// ---------------------------------------------------------------------------
describe('loadPlugins', () => {
  test('returns early when no config file exists', async () => {
    const tr = createToolRegistry();
    const hm = createHookManager();
    // no pluginConfigPath and no default file → should not throw
    await loadPlugins(stubConfig, tr, hm);
    expect(tr.list()).toEqual([]);
  });

  test('skips disabled plugins', async () => {
    await writeTmpFile(
      'disabled-plugin.ts',
      `export default { name: 'disabled', tools: [{ name: 'x', description: 'x', inputSchema: {}, execute: async () => ({ content: 'ok' }) }] };`,
    );
    const configFile = await writeTmpFile(
      'disabled-config.ts',
      `export default [{ path: './disabled-plugin.ts', enabled: false }];`,
    );

    const tr = createToolRegistry();
    const hm = createHookManager();
    await loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, tr, hm);
    expect(tr.has('x')).toBe(false);
  });

  test('rejects duplicate plugin names', async () => {
    await writeTmpFile(
      'dup-a.ts',
      `export default { name: 'dupe' };`,
    );
    await writeTmpFile(
      'dup-b.ts',
      `export default { name: 'dupe' };`,
    );
    const configFile = await writeTmpFile(
      'dup-config.ts',
      `export default [{ path: './dup-a.ts' }, { path: './dup-b.ts' }];`,
    );

    const tr = createToolRegistry();
    const hm = createHookManager();
    await expect(
      loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, tr, hm),
    ).rejects.toThrow("Duplicate plugin name 'dupe'");
  });

  test('rejects tool name collision without replace flag', async () => {
    await writeTmpFile(
      'collision-plugin.ts',
      `export default { name: 'collider', tools: [{ name: 'bash', description: 'x', inputSchema: {}, execute: async () => ({ content: 'ok' }) }] };`,
    );
    const configFile = await writeTmpFile(
      'collision-config.ts',
      `export default [{ path: './collision-plugin.ts' }];`,
    );

    const tr = createToolRegistry();
    tr.register({ name: 'bash', description: 'built-in', inputSchema: {}, execute: async () => ({ content: 'ok' }) });
    const hm = createHookManager();

    await expect(
      loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, tr, hm),
    ).rejects.toThrow("tool 'bash' which already exists");
  });

  test('allows tool name collision with replace: true', async () => {
    await writeTmpFile(
      'replace-plugin.ts',
      `export default { name: 'replacer', tools: [{ name: 'bash', description: 'custom bash', inputSchema: {}, execute: async () => ({ content: 'replaced' }) }] };`,
    );
    const configFile = await writeTmpFile(
      'replace-config.ts',
      `export default [{ path: './replace-plugin.ts', replace: true }];`,
    );

    const tr = createToolRegistry();
    tr.register({ name: 'bash', description: 'built-in', inputSchema: {}, execute: async () => ({ content: 'original' }) });
    const hm = createHookManager();

    await loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, tr, hm);
    const result = await tr.execute('bash', {});
    expect(result.content).toBe('replaced');
  });

  test('registers plugin tools and hooks', async () => {
    await writeTmpFile(
      'full-plugin.ts',
      `export default function(opts) {
        return {
          name: 'full',
          tools: [{ name: 'my_tool', description: 'test', inputSchema: {}, execute: async () => ({ content: 'hello' }) }],
          hooks: {
            onInit(ctx) { ctx.toolRegistry.list(); },
            beforeMessage(msg) { return msg + ' [full]'; },
          },
        };
      }`,
    );
    const configFile = await writeTmpFile(
      'full-config.ts',
      `export default [{ path: './full-plugin.ts', options: { key: 'val' } }];`,
    );

    const tr = createToolRegistry();
    const hm = createHookManager();
    await loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, tr, hm);

    expect(tr.has('my_tool')).toBe(true);
    const result = await tr.execute('my_tool', {});
    expect(result.content).toBe('hello');

    const msg = await hm.runBeforeMessage('test');
    expect(msg).toBe('test [full]');
  });
});

// ---------------------------------------------------------------------------
// tool-registry + hookManager integration
// ---------------------------------------------------------------------------
describe('tool-registry with hookManager', () => {
  test('execute calls beforeToolExecute and afterToolExecute hooks', async () => {
    const hm = createHookManager();
    const calls: string[] = [];
    hm.register('spy', {
      beforeToolExecute: async (name, input) => { calls.push(`before:${name}`); return { name, input }; },
      afterToolExecute: async (name, _input, result) => { calls.push(`after:${name}`); return result; },
    });

    const tr = createToolRegistry(hm);
    tr.register({ name: 'echo', description: 'echo', inputSchema: {}, execute: async (input) => ({ content: String(input.msg) }) });

    const result = await tr.execute('echo', { msg: 'hi' });
    expect(result.content).toBe('hi');
    expect(calls).toEqual(['before:echo', 'after:echo']);
  });

  test('execute blocks when beforeToolExecute returns null', async () => {
    const hm = createHookManager();
    hm.register('blocker', { beforeToolExecute: async () => null });

    const tr = createToolRegistry(hm);
    tr.register({ name: 'echo', description: 'echo', inputSchema: {}, execute: async () => ({ content: 'ok' }) });

    const result = await tr.execute('echo', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('blocked by plugin');
  });

  test('execute without hookManager works unchanged', async () => {
    const tr = createToolRegistry();
    tr.register({ name: 'echo', description: 'echo', inputSchema: {}, execute: async () => ({ content: 'ok' }) });

    const result = await tr.execute('echo', {});
    expect(result.content).toBe('ok');
    expect(result.isError).toBeUndefined();
  });
});
