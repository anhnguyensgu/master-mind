import { colors, style, theme } from './theme';
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

// ──────────────── Box-drawing table renderer ────────────────

interface TableData {
  headers: string[];
  rows: string[][];
  colWidths: number[];
}

function parseMarkdownTable(block: string): TableData | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  // Header row
  const headerLine = lines[0]!;
  const separatorLine = lines[1]!;

  // Must have separator with dashes
  if (!/^\|[\s-:|]+\|$/.test(separatorLine)) return null;

  const parseCells = (line: string) =>
    line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const headers = parseCells(headerLine);
  const rows = lines.slice(2).map(parseCells);

  // Calculate column widths (min 3 for aesthetics)
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow, 3);
  });

  return { headers, rows, colWidths };
}

function renderTable(table: TableData): string {
  const { headers, rows, colWidths } = table;
  const m = theme.muted;
  const r = colors.reset;

  const pad = (text: string, width: number) => {
    const stripped = stripAnsi(text);
    const padding = Math.max(0, width - stripped.length);
    return text + ' '.repeat(padding);
  };

  // Top border: ┌───┬───┐
  const top = `${m}┌${colWidths.map((w) => '─'.repeat(w + 2)).join('┬')}┐${r}`;

  // Header row: │ H1 │ H2 │
  const headerRow = `${m}│${r} ${headers.map((h, i) => `${style.bold}${pad(h, colWidths[i]!)}${r}`).join(` ${m}│${r} `)} ${m}│${r}`;

  // Separator: ├───┼───┤
  const sep = `${m}├${colWidths.map((w) => '─'.repeat(w + 2)).join('┼')}┤${r}`;

  // Data rows: │ d1 │ d2 │
  const dataRows = rows.map(
    (row) => `${m}│${r} ${row.map((cell, i) => `${pad(cell, colWidths[i]!)}${r}`).join(` ${m}│${r} `)} ${m}│${r}`,
  );

  // Bottom border: └───┴───┘
  const bottom = `${m}└${colWidths.map((w) => '─'.repeat(w + 2)).join('┴')}┘${r}`;

  return [top, headerRow, sep, ...dataRows, bottom].join('\n');
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// ──────────────── Markdown renderer ────────────────

function renderMarkdown(text: string): string {
  // First, extract and render tables as blocks
  // Match consecutive lines that start and end with |
  const tableRegex = /^(\|.+\|\n){2,}/gm;

  let result = text.replace(tableRegex, (tableBlock) => {
    const table = parseMarkdownTable(tableBlock.trimEnd());
    if (table) {
      return '\n' + renderTable(table) + '\n';
    }
    return tableBlock;
  });

  // Code blocks: ```lang\n...\n```
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const width = 60;
    const m = theme.muted;
    const r = colors.reset;
    const langLabel = lang ? ` ${lang} ` : '';
    const topBar = `${m}┌${langLabel}${'─'.repeat(Math.max(0, width - langLabel.length - 2))}┐${r}`;
    const bottomBar = `${m}└${'─'.repeat(width - 2)}┘${r}`;

    const codeLines = (code as string).replace(/\n$/, '').split('\n').map(
      (line: string) => `${m}│${r} ${theme.code}${line}${r}`,
    );
    return `\n${topBar}\n${codeLines.join('\n')}\n${bottomBar}\n`;
  });

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, `${style.bold}${theme.code}$1${colors.reset}`);

  // Headers: # ## ###
  result = result.replace(/^### (.+)$/gm, `   ${style.bold}${theme.secondary}$1${colors.reset}`);
  result = result.replace(/^## (.+)$/gm, `\n  ${style.bold}${theme.primary}$1${colors.reset}`);
  result = result.replace(/^# (.+)$/gm, `\n${style.bold}${style.underline}${theme.primary}$1${colors.reset}`);

  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, `${style.bold}$1${colors.reset}`);

  // Italic: *text*
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${style.italic}$1${colors.reset}`);

  // Bullet lists: - item
  result = result.replace(/^(\s*)- (.+)$/gm, `$1  ${theme.muted}•${colors.reset} $2`);

  // Numbered lists: 1. item
  result = result.replace(/^(\s*)(\d+)\. (.+)$/gm, `$1  ${theme.muted}$2.${colors.reset} $3`);

  // Horizontal rules
  result = result.replace(/^---+$/gm, `${theme.muted}${'─'.repeat(60)}${colors.reset}`);

  return result;
}

// ──────────────── Inline line formatter ────────────────

function formatInlineLine(line: string): string {
  let result = line;

  // Headers: # ## ###
  if (/^### .+$/.test(result)) {
    result = result.replace(/^### (.+)$/, `   ${style.bold}${theme.secondary}$1${colors.reset}`);
    return result;
  }
  if (/^## .+$/.test(result)) {
    result = result.replace(/^## (.+)$/, `\n  ${style.bold}${theme.primary}$1${colors.reset}`);
    return result;
  }
  if (/^# .+$/.test(result)) {
    result = result.replace(/^# (.+)$/, `\n${style.bold}${style.underline}${theme.primary}$1${colors.reset}`);
    return result;
  }

  // Horizontal rules
  if (/^---+$/.test(result)) {
    return `${theme.muted}${'─'.repeat(60)}${colors.reset}`;
  }

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, `${style.bold}${theme.code}$1${colors.reset}`);

  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, `${style.bold}$1${colors.reset}`);

  // Italic: *text*
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${style.italic}$1${colors.reset}`);

  // Bullet lists: - item
  result = result.replace(/^(\s*)- (.+)$/, `$1  ${theme.muted}•${colors.reset} $2`);

  // Numbered lists: 1. item
  result = result.replace(/^(\s*)(\d+)\. (.+)$/, `$1  ${theme.muted}$2.${colors.reset} $3`);

  return result;
}

function renderCodeBlock(lines: string[], lang: string): string {
  const width = 60;
  const m = theme.muted;
  const r = colors.reset;
  const langLabel = lang ? ` ${lang} ` : '';
  const topBar = `${m}┌${langLabel}${'─'.repeat(Math.max(0, width - langLabel.length - 2))}┐${r}`;
  const bottomBar = `${m}└${'─'.repeat(width - 2)}┘${r}`;

  const codeLines = lines.map((line) => `${m}│${r} ${theme.code}${line}${r}`);
  return `\n${topBar}\n${codeLines.join('\n')}\n${bottomBar}`;
}

// ──────────────── Stream state ────────────────

const enum StreamState {
  NORMAL = 0,
  CODEBLOCK = 1,
  TABLE = 2,
}

// ──────────────── Renderer factory ────────────────

export function createRenderer(): Renderer {
  let inStream = false;
  let currentLine = '';
  let state: StreamState = StreamState.NORMAL;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';
  let tableLines: string[] = [];

  function write(text: string) {
    process.stdout.write(text);
  }

  function writeln(text: string) {
    process.stdout.write(text + '\n');
  }

  function emitFormattedLine(line: string) {
    writeln(formatInlineLine(line));
  }

  function flushCodeBlock() {
    write(renderCodeBlock(codeBlockLines, codeBlockLang) + '\n');
    codeBlockLines = [];
    codeBlockLang = '';
  }

  function flushTable() {
    const block = tableLines.join('\n');
    const table = parseMarkdownTable(block);
    if (table) {
      write('\n' + renderTable(table) + '\n');
    } else {
      // Not a valid table — emit lines as-is formatted
      for (const tl of tableLines) {
        emitFormattedLine(tl);
      }
    }
    tableLines = [];
  }

  function processCompletedLine(line: string) {
    switch (state) {
      case StreamState.CODEBLOCK:
        if (line.startsWith('```')) {
          // Close code block
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
          // Table ended — render buffered table
          flushTable();
          state = StreamState.NORMAL;
          // Process this non-table line normally
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
      emitFormattedLine(line);
    }
  }

  function resetStreamState() {
    inStream = false;
    currentLine = '';
    state = StreamState.NORMAL;
    codeBlockLines = [];
    codeBlockLang = '';
    tableLines = [];
  }

  return {
    banner() {
      writeln('');
      writeln(`${theme.primary}          `);
      writeln(`${theme.primary}  ▐▛███▜▌ `);
      writeln(`${theme.primary} ▝▜█████▛▘`);
      writeln(`${theme.primary}   ▘▘ ▝▝  ${colors.reset}`);
      writeln('');
      writeln(`${style.bold}${theme.primary}  Master Mind${colors.reset} ${theme.muted}— Cloud Cost Optimization Agent${colors.reset}`);
      writeln(`${theme.muted}  Type ${colors.reset}/help${theme.muted} for commands, ${colors.reset}/quit${theme.muted} to exit${colors.reset}`);
      writeln('');
    },

    help() {
      writeln('');
      writeln(`${style.bold}${theme.primary}Commands:${colors.reset}`);
      writeln(`  ${theme.accent}/help${colors.reset}     Show this help`);
      writeln(`  ${theme.accent}/quit${colors.reset}     Exit the agent`);
      writeln(`  ${theme.accent}/clear${colors.reset}    Clear conversation history`);
      writeln(`  ${theme.accent}/history${colors.reset}  Show conversation history`);
      writeln(`  ${theme.accent}/cost${colors.reset}     Show token usage & estimated cost`);
      writeln(`  ${theme.accent}/model${colors.reset}    Show current model info`);
      writeln('');
      writeln(`${style.bold}${theme.primary}Tips:${colors.reset}`);
      writeln(`  ${theme.muted}End a line with \\ for multiline input${colors.reset}`);
      writeln(`  ${theme.muted}Ask about cloud costs, resource utilization, or optimization${colors.reset}`);
      writeln('');
    },

    streamText(chunk: string) {
      if (!inStream) {
        inStream = true;
        currentLine = '';
        state = StreamState.NORMAL;
        codeBlockLines = [];
        codeBlockLang = '';
        tableLines = [];
      }

      for (const char of chunk) {
        currentLine += char;

        if (char !== '\n') {
          // Show incomplete line raw, overwritten in place
          write(`\r\x1b[K${currentLine}`);
          continue;
        }

        // Line completed — clear the raw preview and process it
        write(`\r\x1b[K`);
        const line = currentLine.slice(0, -1); // remove trailing \n
        currentLine = '';
        processCompletedLine(line);
      }
    },

    endStream() {
      if (inStream) {
        // Flush any remaining incomplete line
        if (currentLine) {
          write(`\r\x1b[K`);
          const line = currentLine;
          currentLine = '';
          processCompletedLine(line);
        }
        // Flush any open blocks
        if (state === StreamState.CODEBLOCK) {
          flushCodeBlock();
        } else if (state === StreamState.TABLE) {
          flushTable();
        }
        write(colors.reset);
        resetStreamState();
      }
    },

    toolStart(name: string, input: Record<string, unknown>) {
      const inputStr = JSON.stringify(input, null, 0);
      const truncated = inputStr.length > 100 ? inputStr.slice(0, 97) + '...' : inputStr;
      writeln(`\n  ${theme.tool}⚡ ${name}${colors.reset} ${theme.muted}${truncated}${colors.reset}`);
    },

    toolEnd(name: string, durationMs: number) {
      writeln(`  ${theme.success}✓ ${name}${colors.reset} ${theme.muted}(${durationMs}ms)${colors.reset}`);
    },

    toolError(name: string, error: string) {
      writeln(`  ${theme.error}✗ ${name}${colors.reset}: ${error}`);
    },

    error(message: string) {
      writeln(`${theme.error}Error: ${message}${colors.reset}`);
    },

    info(message: string) {
      writeln(`${theme.info}${message}${colors.reset}`);
    },

    warning(message: string) {
      writeln(`${theme.warning}${message}${colors.reset}`);
    },

    success(message: string) {
      writeln(`${theme.success}${message}${colors.reset}`);
    },

    usage(usage: TokenUsage) {
      writeln('');
      writeln(`${style.bold}${theme.primary}Token Usage:${colors.reset}`);
      writeln(`  Input:  ${theme.accent}${usage.inputTokens.toLocaleString()}${colors.reset}`);
      writeln(`  Output: ${theme.accent}${usage.outputTokens.toLocaleString()}${colors.reset}`);
      writeln(`  Total:  ${theme.accent}${(usage.inputTokens + usage.outputTokens).toLocaleString()}${colors.reset}`);
      writeln('');
    },

    divider() {
      writeln(`${theme.muted}${'─'.repeat(60)}${colors.reset}`);
    },

    markdown(text: string) {
      writeln(renderMarkdown(text));
    },

    newline() {
      writeln('');
    },
  };
}
