import { test, expect, describe, afterAll, spyOn } from 'bun:test';
import { resolve } from 'node:path';
import { loadToolConfig, loadToolsFromConfig } from './tool-loader';
import type { MasterMindConfig } from '../../config/config.types';

const tmpDir = resolve(import.meta.dir, '__test_loader_fixtures__');

const stubConfig: MasterMindConfig = {
  llm: { provider: 'mock', model: 'mock-1.0', baseUrl: '', maxTokens: 100 },
  costApi: { baseUrl: '', token: '', defaultProvider: 'aws' },
  agent: { maxIterations: 1 },
};

async function writeTmpFile(name: string, content: string): Promise<string> {
  const filePath = resolve(tmpDir, name);
  await Bun.write(filePath, content);
  return filePath;
}

afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(tmpDir, { recursive: true, force: true });
});

describe('loadToolConfig', () => {
  test('reads .ts file with default export array', async () => {
    const configPath = await writeTmpFile(
      'tools-config.ts',
      `export default [{ id: 'echo', module: './echo-tool.ts' }];`,
    );
    const specs = await loadToolConfig(configPath);
    expect(specs).toHaveLength(1);
    expect(specs[0].id).toBe('echo');
  });

  test('reads .json file with tools array', async () => {
    const configPath = await writeTmpFile(
      'tools-config.json',
      JSON.stringify({ tools: [{ id: 'ping', module: './ping.ts' }] }),
    );
    const specs = await loadToolConfig(configPath);
    expect(specs).toHaveLength(1);
    expect(specs[0].id).toBe('ping');
  });

  test('throws on missing file', async () => {
    await expect(loadToolConfig('/nonexistent/path/tools.ts')).rejects.toThrow(
      'Tool config not found',
    );
  });

  test('throws on invalid .json format', async () => {
    const configPath = await writeTmpFile(
      'bad-tools.json',
      JSON.stringify({ notTools: [] }),
    );
    await expect(loadToolConfig(configPath)).rejects.toThrow(
      'expected { tools: ToolSpec[] }',
    );
  });

  test('throws on invalid .ts format', async () => {
    const configPath = await writeTmpFile(
      'bad-tools.ts',
      `export default "not an array";`,
    );
    await expect(loadToolConfig(configPath)).rejects.toThrow(
      'default export must be ToolSpec[]',
    );
  });
});

describe('loadToolsFromConfig', () => {
  test('skips disabled specs', async () => {
    const specs = [{ id: 'disabled', module: './nope.ts', enabled: false as const }];
    const tools = await loadToolsFromConfig(specs, stubConfig, tmpDir);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  test('loads direct tool exports', async () => {
    await writeTmpFile(
      'direct-tool.ts',
      `import { createTool } from '@mastra/core/tools';
      import { z } from 'zod';
      export default createTool({
        id: 'direct',
        description: 'Direct tool',
        inputSchema: z.object({}),
        execute: async () => ({ content: 'direct' }),
      });`,
    );
    const specs = [{ id: 'direct', module: './direct-tool.ts' }];
    const tools = await loadToolsFromConfig(specs, stubConfig, tmpDir);
    expect(tools.direct).toBeDefined();
    expect(tools.direct.id).toBe('direct');
  });

  test('calls factory functions', async () => {
    await writeTmpFile(
      'factory-tool.ts',
      `import { createTool } from '@mastra/core/tools';
      import { z } from 'zod';
      export default function(config, options) {
        return createTool({
          id: 'factory',
          description: 'Factory tool with option: ' + (options?.key ?? 'none'),
          inputSchema: z.object({}),
          execute: async () => ({ content: 'factory' }),
        });
      }`,
    );
    const specs = [{ id: 'factory', module: './factory-tool.ts', options: { key: 'val' } }];
    const tools = await loadToolsFromConfig(specs, stubConfig, tmpDir);
    expect(tools.factory).toBeDefined();
    expect(tools.factory.description).toContain('val');
  });

  test('continues on failure and logs error', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});

    await writeTmpFile(
      'good-tool.ts',
      `import { createTool } from '@mastra/core/tools';
      import { z } from 'zod';
      export default createTool({
        id: 'good',
        description: 'Good tool',
        inputSchema: z.object({}),
        execute: async () => ({ content: 'good' }),
      });`,
    );

    const specs = [
      { id: 'bad', module: './nonexistent-module-xyz.ts' },
      { id: 'good', module: './good-tool.ts' },
    ];
    const tools = await loadToolsFromConfig(specs, stubConfig, tmpDir);

    // Bad tool failed but good tool still loaded
    expect(tools.bad).toBeUndefined();
    expect(tools.good).toBeDefined();

    const calls = spy.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('[tool-loader] Failed to load tool "bad"'))).toBe(true);
    spy.mockRestore();
  });
});
