import { test, expect, describe, afterAll } from 'bun:test';
import { resolve } from 'node:path';
import { loadPlugins } from './plugin-loader';
import { createHookManager } from './hook-manager';
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
  llm: { provider: 'mock',  model: 'mock-1.0', baseUrl: '', maxTokens: 100 },
  costApi: { baseUrl: '', token: '', defaultProvider: 'aws' },
  agent: { maxIterations: 1 },
};

describe('loadPlugins', () => {
  test('returns early when no config path is set', async () => {
    const hm = createHookManager();
    await loadPlugins(stubConfig, hm);
    // should not throw
  });

  test('skips disabled plugins', async () => {
    await writeTmpFile(
      'disabled-plugin.ts',
      `export default { name: 'disabled', hooks: { beforeMessage: async (m) => m + ' [disabled]' } };`,
    );
    const configFile = await writeTmpFile(
      'disabled-config.ts',
      `export default [{ path: './disabled-plugin.ts', enabled: false }];`,
    );

    const hm = createHookManager();
    await loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, hm);
    const msg = await hm.runBeforeMessage('test');
    expect(msg).toBe('test'); // hook was NOT registered
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

    const hm = createHookManager();
    await expect(
      loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, hm),
    ).rejects.toThrow("Duplicate plugin name 'dupe'");
  });

  test('registers plugin hooks', async () => {
    await writeTmpFile(
      'hooks-plugin.ts',
      `export default function(opts) {
        return {
          name: 'hooks-test',
          hooks: {
            beforeMessage(msg) { return msg + ' [hooked]'; },
          },
        };
      }`,
    );
    const configFile = await writeTmpFile(
      'hooks-config.ts',
      `export default [{ path: './hooks-plugin.ts', options: { key: 'val' } }];`,
    );

    const hm = createHookManager();
    await loadPlugins({ ...stubConfig, pluginConfigPath: configFile }, hm);

    const msg = await hm.runBeforeMessage('test');
    expect(msg).toBe('test [hooked]');
  });
});
