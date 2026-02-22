import { test, expect, describe } from 'bun:test';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ToolRegistry } from './tool-registry';

function stubTool(id: string) {
  return createTool({
    id,
    description: `Tool ${id}`,
    inputSchema: z.object({}),
    execute: async () => ({ content: id }),
  });
}

describe('ToolRegistry', () => {
  test('register and retrieve a tool', () => {
    const registry = new ToolRegistry();
    const tool = stubTool('bash');
    registry.register('bash', tool, { group: 'system', source: 'builtin' });

    expect(registry.get('bash')).toBe(tool);
    expect(registry.has('bash')).toBe(true);
    expect(registry.list()).toContain('bash');
  });

  test('register rejects duplicates', () => {
    const registry = new ToolRegistry();
    registry.register('bash', stubTool('bash'), { group: 'system', source: 'builtin' });

    expect(() =>
      registry.register('bash', stubTool('bash2'), { group: 'system', source: 'plugin' }),
    ).toThrow('Tool "bash" is already registered');
  });

  test('override replaces existing tool', () => {
    const registry = new ToolRegistry();
    const original = stubTool('bash');
    const replacement = stubTool('bash-v2');

    registry.register('bash', original, { group: 'system', source: 'builtin' });
    registry.override('bash', replacement, { source: 'plugin' });

    expect(registry.get('bash')).toBe(replacement);
    expect(registry.getMeta('bash')?.source).toBe('plugin');
    expect(registry.getMeta('bash')?.group).toBe('system'); // preserved
  });

  test('override throws for non-existent tool', () => {
    const registry = new ToolRegistry();
    expect(() =>
      registry.override('missing', stubTool('x')),
    ).toThrow('Cannot override "missing": not registered');
  });

  test('all() returns full map', () => {
    const registry = new ToolRegistry();
    registry.register('a', stubTool('a'), { group: 'g1', source: 's' });
    registry.register('b', stubTool('b'), { group: 'g2', source: 's' });
    registry.register('c', stubTool('c'), { group: 'g1', source: 's' });

    const all = registry.all();
    expect(Object.keys(all)).toHaveLength(3);
  });

  test('byGroup() filters correctly', () => {
    const registry = new ToolRegistry();
    registry.register('cost_query', stubTool('cq'), { group: 'cost', source: 'builtin' });
    registry.register('cost_summary', stubTool('cs'), { group: 'cost', source: 'builtin' });
    registry.register('bash', stubTool('bash'), { group: 'system', source: 'builtin' });

    const costTools = registry.byGroup('cost');
    expect(Object.keys(costTools)).toEqual(['cost_query', 'cost_summary']);

    const systemTools = registry.byGroup('system');
    expect(Object.keys(systemTools)).toEqual(['bash']);
  });

  test('groups() returns distinct groups', () => {
    const registry = new ToolRegistry();
    registry.register('a', stubTool('a'), { group: 'cost', source: 's' });
    registry.register('b', stubTool('b'), { group: 'cost', source: 's' });
    registry.register('c', stubTool('c'), { group: 'cloud', source: 's' });

    const groups = registry.groups();
    expect(groups.sort()).toEqual(['cloud', 'cost']);
  });

  test('remove() deletes tool and metadata', () => {
    const registry = new ToolRegistry();
    registry.register('x', stubTool('x'), { group: 'g', source: 's' });

    expect(registry.remove('x')).toBe(true);
    expect(registry.get('x')).toBeUndefined();
    expect(registry.has('x')).toBe(false);
    expect(registry.getMeta('x')).toBeUndefined();
  });

  test('has() returns correct boolean', () => {
    const registry = new ToolRegistry();
    expect(registry.has('nope')).toBe(false);
    registry.register('yes', stubTool('yes'), { group: 'g', source: 's' });
    expect(registry.has('yes')).toBe(true);
  });
});
