import { test, expect, describe, spyOn, afterEach } from 'bun:test';
import { resolveEnabledGroups, BUILTIN_TOOL_GROUPS, ALL_GROUPS } from './tool-groups';

describe('tool-groups', () => {
  const originalEnv = process.env.MASTER_MIND_TOOL_GROUPS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MASTER_MIND_TOOL_GROUPS;
    } else {
      process.env.MASTER_MIND_TOOL_GROUPS = originalEnv;
    }
  });

  test('resolveEnabledGroups returns all groups by default', () => {
    delete process.env.MASTER_MIND_TOOL_GROUPS;
    const groups = resolveEnabledGroups();
    expect(groups.sort()).toEqual([...ALL_GROUPS].sort());
  });

  test('resolveEnabledGroups respects env var', () => {
    process.env.MASTER_MIND_TOOL_GROUPS = 'cost, cloud';
    const groups = resolveEnabledGroups();
    expect(groups.sort()).toEqual(['cloud', 'cost']);
  });

  test('resolveEnabledGroups falls back to all on invalid input', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    process.env.MASTER_MIND_TOOL_GROUPS = 'invalid_group';
    const groups = resolveEnabledGroups();
    expect(groups.sort()).toEqual([...ALL_GROUPS].sort());

    const calls = spy.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('matched no valid groups'))).toBe(true);
    spy.mockRestore();
  });

  test('BUILTIN_TOOL_GROUPS covers all 7 built-in tools', () => {
    const allTools = Object.values(BUILTIN_TOOL_GROUPS).flat();
    expect(allTools).toHaveLength(7);
    expect(allTools).toContain('cost_query');
    expect(allTools).toContain('cost_summary');
    expect(allTools).toContain('cost_by_service');
    expect(allTools).toContain('bash');
    expect(allTools).toContain('cloud_cli');
    expect(allTools).toContain('resource_list');
    expect(allTools).toContain('resource_metrics');
  });
});
