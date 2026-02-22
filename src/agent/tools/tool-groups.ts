export const BUILTIN_TOOL_GROUPS = {
  cost: ['cost_query', 'cost_summary', 'cost_by_service'],
  cloud: ['cloud_cli', 'resource_list', 'resource_metrics'],
  system: ['bash'],
} as const;

export type ToolGroupName = keyof typeof BUILTIN_TOOL_GROUPS;

export const ALL_GROUPS: ToolGroupName[] = ['cost', 'cloud', 'system'];

/**
 * Resolves which tool groups should be enabled.
 * Reads from MASTER_MIND_TOOL_GROUPS env var (comma-separated).
 * If not set, all groups are enabled.
 */
export function resolveEnabledGroups(): ToolGroupName[] {
  const envVal = process.env.MASTER_MIND_TOOL_GROUPS;
  if (!envVal) return [...ALL_GROUPS];

  const requested = envVal.split(',').map(g => g.trim()) as ToolGroupName[];
  const valid = requested.filter(g => ALL_GROUPS.includes(g));

  if (valid.length === 0) {
    console.error(
      `[tool-groups] MASTER_MIND_TOOL_GROUPS="${envVal}" matched no valid groups. Valid: ${ALL_GROUPS.join(', ')}. Using all groups.`,
    );
    return [...ALL_GROUPS];
  }

  return valid;
}
