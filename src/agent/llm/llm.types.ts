import type { TokenUsage } from '../agent.types';

/** Unified message format across all providers */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export type LLMContentBlock =
  | LLMTextBlock
  | LLMToolUseBlock
  | LLMToolResultBlock;

export interface LLMTextBlock {
  type: 'text';
  text: string;
}

export interface LLMToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** Unified tool definition */
export interface LLMToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Callbacks for streaming */
export interface StreamCallbacks {
  onText(chunk: string): void;
  onToolUse(id: string, name: string, input: Record<string, unknown>): void;
  onError(error: Error): void;
}

/** The core contract -- every LLM provider implements this */
export interface LLMProvider {
  /** Stream a message, return the full response when done */
  streamMessage(
    messages: LLMMessage[],
    systemPrompt: string,
    tools: LLMToolDef[],
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse>;

  /** Get cumulative token usage */
  getUsage(): TokenUsage;

  /** Provider name for display */
  readonly name: string;

  /** Model name for display */
  readonly model: string;
}

export interface LLMResponse {
  content: LLMContentBlock[];
  stopReason: 'end' | 'tool_use';
  usage: { inputTokens: number; outputTokens: number };
}
