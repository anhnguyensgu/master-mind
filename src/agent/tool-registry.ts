import type { AgentTool, ToolExecutionResult } from './agent.types';
import type { LLMToolDef } from './llm/llm.types';

export interface ToolRegistry {
  register(tool: AgentTool): void;
  getLLMTools(): LLMToolDef[];
  execute(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult>;
  has(name: string): boolean;
  list(): string[];
}

export function createToolRegistry(): ToolRegistry {
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
      const tool = tools.get(name);
      if (!tool) {
        return { content: `Unknown tool: ${name}`, isError: true };
      }

      try {
        return await tool.execute(input);
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
