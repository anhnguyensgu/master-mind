import type { Tool } from '@mastra/core/tools';

export type ToolWrapper = (tool: Tool) => Tool;

/**
 * Logs tool invocations with timing to stderr.
 */
export function withLogging(tool: Tool): Tool {
  const originalExecute = tool.execute?.bind(tool);
  if (!originalExecute) return tool;

  return Object.assign(Object.create(Object.getPrototypeOf(tool)), tool, {
    execute: async (...args: unknown[]) => {
      const start = Date.now();
      const inputStr = JSON.stringify(args[0], null, 0);
      const truncated = inputStr.length > 200 ? inputStr.slice(0, 197) + '...' : inputStr;
      console.error(`[tool:${tool.id}] start | input: ${truncated}`);
      try {
        const result = await originalExecute(...args);
        console.error(`[tool:${tool.id}] done (${Date.now() - start}ms)`);
        return result;
      } catch (err) {
        console.error(`[tool:${tool.id}] error (${Date.now() - start}ms): ${err}`);
        throw err;
      }
    },
  });
}

/**
 * Caches tool results by input hash for a configurable TTL.
 */
export function withCache(tool: Tool, ttlMs: number): Tool {
  const cache = new Map<string, { result: unknown; expires: number }>();
  const originalExecute = tool.execute?.bind(tool);
  if (!originalExecute) return tool;

  return Object.assign(Object.create(Object.getPrototypeOf(tool)), tool, {
    execute: async (...args: unknown[]) => {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.result;
      }
      const result = await originalExecute(...args);
      cache.set(key, { result, expires: Date.now() + ttlMs });
      return result;
    },
  });
}

/**
 * Applies one or more wrappers to a tool, left-to-right.
 */
export function composeMiddleware(...wrappers: ToolWrapper[]): ToolWrapper {
  return (tool: Tool) => wrappers.reduce((t, wrapper) => wrapper(t), tool);
}
