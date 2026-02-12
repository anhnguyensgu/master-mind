export type ChatItem =
  | { type: 'text'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; lines: string[]; lang: string }
  | { type: 'table'; headers: string[]; rows: string[][]; colWidths: number[] }
  | { type: 'list_item'; text: string; ordered: boolean; index?: number }
  | { type: 'divider' }
  | { type: 'newline' }
  | { type: 'tool_start'; name: string; input: string }
  | { type: 'tool_end'; name: string; durationMs: number }
  | { type: 'tool_error'; name: string; error: string }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'success'; message: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'banner' }
  | { type: 'help' };
