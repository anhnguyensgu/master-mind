import type { TokenUsage } from '../agent/agent.types';

export interface Renderer {
  banner(): void;
  help(): void;
  streamText(chunk: string): void;
  endStream(): void;
  toolStart(name: string, input: Record<string, unknown>): void;
  toolEnd(name: string, durationMs: number): void;
  toolError(name: string, error: string): void;
  error(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  success(message: string): void;
  usage(usage: TokenUsage): void;
  divider(): void;
  markdown(text: string): void;
  newline(): void;
}
