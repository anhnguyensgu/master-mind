export const CHAT_ITEM_TYPE = {
  TEXT: 'text',
  HEADING: 'heading',
  CODE: 'code',
  TABLE: 'table',
  LIST_ITEM: 'list_item',
  DIVIDER: 'divider',
  NEWLINE: 'newline',
  TOOL_START: 'tool_start',
  TOOL_END: 'tool_end',
  TOOL_ERROR: 'tool_error',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
  SUCCESS: 'success',
  USAGE: 'usage',
  BANNER: 'banner',
  HELP: 'help',
} as const;

export type ChatItemType = typeof CHAT_ITEM_TYPE[keyof typeof CHAT_ITEM_TYPE];

export type ChatItem =
  | { type: typeof CHAT_ITEM_TYPE.TEXT; text: string }
  | { type: typeof CHAT_ITEM_TYPE.HEADING; level: 1 | 2 | 3; text: string }
  | { type: typeof CHAT_ITEM_TYPE.CODE; lines: string[]; lang: string }
  | { type: typeof CHAT_ITEM_TYPE.TABLE; headers: string[]; rows: string[][]; colWidths: number[] }
  | { type: typeof CHAT_ITEM_TYPE.LIST_ITEM; text: string; ordered: boolean; index?: number }
  | { type: typeof CHAT_ITEM_TYPE.DIVIDER }
  | { type: typeof CHAT_ITEM_TYPE.NEWLINE }
  | { type: typeof CHAT_ITEM_TYPE.TOOL_START; name: string; input: string }
  | { type: typeof CHAT_ITEM_TYPE.TOOL_END; name: string; durationMs: number }
  | { type: typeof CHAT_ITEM_TYPE.TOOL_ERROR; name: string; error: string }
  | { type: typeof CHAT_ITEM_TYPE.ERROR; message: string }
  | { type: typeof CHAT_ITEM_TYPE.INFO; message: string }
  | { type: typeof CHAT_ITEM_TYPE.WARNING; message: string }
  | { type: typeof CHAT_ITEM_TYPE.SUCCESS; message: string }
  | { type: typeof CHAT_ITEM_TYPE.USAGE; inputTokens: number; outputTokens: number }
  | { type: typeof CHAT_ITEM_TYPE.BANNER }
  | { type: typeof CHAT_ITEM_TYPE.HELP };
