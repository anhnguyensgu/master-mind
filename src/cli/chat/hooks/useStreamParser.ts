import type { ChatItem } from '../types/chatItems.ts';
import { CHAT_ITEM_TYPE } from '../types/chatItems.ts';
import { parseMarkdownTable } from '../../utils/format.ts';

const enum StreamState {
  NORMAL = 0,
  CODEBLOCK = 1,
  TABLE = 2,
}

export function createStreamParser(emit: (item: ChatItem) => void) {
  let state: StreamState = StreamState.NORMAL;
  let currentLine = '';
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';
  let tableLines: string[] = [];

  function flushCodeBlock() {
    emit({ type: CHAT_ITEM_TYPE.CODE, lines: codeBlockLines, lang: codeBlockLang });
    codeBlockLines = [];
    codeBlockLang = '';
  }

  function flushTable() {
    const block = tableLines.join('\n');
    const table = parseMarkdownTable(block);
    if (table) {
      emit({ type: CHAT_ITEM_TYPE.TABLE, headers: table.headers, rows: table.rows, colWidths: table.colWidths });
    } else {
      for (const tl of tableLines) {
        emitNormalLine(tl);
      }
    }
    tableLines = [];
  }

  function emitNormalLine(line: string) {
    // Headings
    const h1 = line.match(/^# (.+)$/);
    if (h1) { emit({ type: CHAT_ITEM_TYPE.HEADING, level: 1, text: h1[1]! }); return; }

    const h2 = line.match(/^## (.+)$/);
    if (h2) { emit({ type: CHAT_ITEM_TYPE.HEADING, level: 2, text: h2[1]! }); return; }

    const h3 = line.match(/^### (.+)$/);
    if (h3) { emit({ type: CHAT_ITEM_TYPE.HEADING, level: 3, text: h3[1]! }); return; }

    // Horizontal rules
    if (/^---+$/.test(line)) { emit({ type: CHAT_ITEM_TYPE.DIVIDER }); return; }

    // Unordered list
    const ul = line.match(/^(\s*)- (.+)$/);
    if (ul) { emit({ type: CHAT_ITEM_TYPE.LIST_ITEM, text: ul[2]!, ordered: false }); return; }

    // Ordered list
    const ol = line.match(/^(\s*)(\d+)\. (.+)$/);
    if (ol) { emit({ type: CHAT_ITEM_TYPE.LIST_ITEM, text: ol[3]!, ordered: true, index: parseInt(ol[2]!, 10) }); return; }

    // Empty line
    if (line === '') { emit({ type: CHAT_ITEM_TYPE.NEWLINE }); return; }

    // Plain text (with possible inline formatting)
    emit({ type: CHAT_ITEM_TYPE.TEXT, text: line });
  }

  function processCompletedLine(line: string) {
    switch (state) {
      case StreamState.CODEBLOCK:
        if (line.startsWith('```')) {
          flushCodeBlock();
          state = StreamState.NORMAL;
        } else {
          codeBlockLines.push(line);
        }
        break;

      case StreamState.TABLE:
        if (line.startsWith('|')) {
          tableLines.push(line);
        } else {
          flushTable();
          state = StreamState.NORMAL;
          processNormalLine(line);
        }
        break;

      case StreamState.NORMAL:
        processNormalLine(line);
        break;
    }
  }

  function processNormalLine(line: string) {
    if (line.startsWith('```')) {
      state = StreamState.CODEBLOCK;
      codeBlockLang = line.slice(3).trim();
      codeBlockLines = [];
    } else if (line.startsWith('|')) {
      state = StreamState.TABLE;
      tableLines = [line];
    } else {
      emitNormalLine(line);
    }
  }

  return {
    feed(chunk: string) {
      for (const char of chunk) {
        currentLine += char;
        if (char === '\n') {
          const line = currentLine.slice(0, -1);
          currentLine = '';
          processCompletedLine(line);
        }
      }
    },

    flush() {
      if (currentLine) {
        const line = currentLine;
        currentLine = '';
        processCompletedLine(line);
      }
      if (state === StreamState.CODEBLOCK) {
        flushCodeBlock();
      } else if (state === StreamState.TABLE) {
        flushTable();
      }
      state = StreamState.NORMAL;
    },

    getCurrentLine(): string {
      return currentLine;
    },
  };
}
