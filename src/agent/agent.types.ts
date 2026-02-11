export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  content: string;
  isError?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentConfig {
  maxIterations: number;
}
