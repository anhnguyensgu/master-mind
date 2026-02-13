import { test, expect, describe, afterAll } from 'bun:test';
import { resolve, dirname } from 'node:path';
import { loadPluginConfig } from './plugin-loader';

const tmpDir = resolve(import.meta.dir, '__test_fixtures_config__');

async function writeTmpFile(name: string, content: string): Promise<string> {
  const filePath = resolve(tmpDir, name);
  await Bun.write(filePath, content);
  return filePath;
}

afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(tmpDir, { recursive: true, force: true });
});

describe('loadPluginConfig', () => {
  test('throws when configPath points to a missing file', async () => {
    await expect(
      loadPluginConfig('/nonexistent/path/config.ts'),
    ).rejects.toThrow('Plugin config not found: /nonexistent/path/config.ts');
  });

  test('loads and returns valid specs from a .ts file', async () => {
    const configFile = await writeTmpFile(
      'valid-config.ts',
      `export default [{ path: './my-plugin.ts' }];`,
    );

    const result = await loadPluginConfig(configFile);

    expect(result.specs).toEqual([{ path: './my-plugin.ts' }]);
    expect(result.configDir).toBe(dirname(configFile));
  });

  test('throws on invalid config (default export is not an array)', async () => {
    const configFile = await writeTmpFile(
      'invalid-config.ts',
      `export default { plugins: [] };`,
    );

    await expect(loadPluginConfig(configFile)).rejects.toThrow(
      'default export must be a PluginSpec[]',
    );
  });

  test('configDir is the directory of the config file', async () => {
    const configFile = await writeTmpFile(
      'subdir-config.ts',
      `export default [{ path: './plugins/a.ts' }];`,
    );

    const result = await loadPluginConfig(configFile);

    expect(result.configDir).toBe(tmpDir);
  });
});
