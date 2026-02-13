import type { AgentTool, ToolExecutionResult } from './agent.types';
import type { LLMToolDef } from './llm/llm.types';
import type { HookManager } from './plugins/hook-manager';

export interface ToolRegistry {
  register(tool: AgentTool): void;
  getLLMTools(): LLMToolDef[];
  execute(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
  has(name: string): boolean;
  list(): string[];
}

export function createToolRegistry(hookManager?: HookManager): ToolRegistry {
  const tools = new Map<string, AgentTool>();

  return {
    register(tool: AgentTool) {
      tools.set(tool.name, tool);
    },

    getLLMTools(): LLMToolDef[] {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
    },

    async execute(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult> {
      let resolvedName = name;
      let resolvedInput = input;

      if (hookManager) {
        const hookResult = await hookManager.runBeforeToolExecute(name, input);
        if (hookResult === null) {
          return { content: `Tool execution blocked by plugin for tool: ${name}`, isError: true };
        }
        resolvedName = hookResult.name;
        resolvedInput = hookResult.input;
      }

      const tool = tools.get(resolvedName);
      if (!tool) {
        return { content: `Unknown tool: ${resolvedName}`, isError: true };
      }

      try {
        let result = await tool.execute(resolvedInput);

        if (hookManager) {
          result = await hookManager.runAfterToolExecute(resolvedName, resolvedInput, result);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Tool execution error: ${message}`, isError: true };
      }
    },

    has(name: string) {
      return tools.has(name);
    },

    list() {
      return Array.from(tools.keys());
    },
  };
}
