import { resolve, dirname } from 'node:path';
import type { Tool } from '@mastra/core/tools';
import type { MasterMindConfig } from '../../config/config.types';

export interface ToolSpec {
  id: string;
  module: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

export async function loadToolConfig(configPath: string): Promise<ToolSpec[]> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Tool config not found: ${configPath}`);
  }

  if (configPath.endsWith('.json')) {
    const data = await file.json();
    if (!Array.isArray(data?.tools)) {
      throw new Error(
        `Invalid tool config at ${configPath}: expected { tools: ToolSpec[] }`,
      );
    }
    return data.tools as ToolSpec[];
  }

  const mod = await import(configPath);
  const specs = mod.default;
  if (!Array.isArray(specs)) {
    throw new Error(
      `Invalid tool config at ${configPath}: default export must be ToolSpec[]`,
    );
  }
  return specs as ToolSpec[];
}

export async function loadToolsFromConfig(
  specs: ToolSpec[],
  config: MasterMindConfig,
  configDir: string,
): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};

  for (const spec of specs) {
    if (spec.enabled === false) continue;

    const modulePath = spec.module.startsWith('.')
      ? resolve(configDir, spec.module)
      : spec.module;

    try {
      const mod = await import(modulePath);
      const exported = mod.default;

      let tool: Tool;
      if (typeof exported === 'function') {
        tool = await exported(config, spec.options);
      } else if (exported && typeof exported.execute === 'function') {
        tool = exported;
      } else {
        throw new Error(
          `Tool module at ${modulePath} must default-export a tool object or factory function`,
        );
      }

      tools[spec.id] = tool;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[tool-loader] Failed to load tool "${spec.id}" from ${modulePath}: ${message}`,
      );
    }
  }

  return tools;
}
