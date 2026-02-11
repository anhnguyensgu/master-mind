import { colors, style, theme } from './theme';
import {
  stripAnsi,
  parseMarkdownTable,
  renderTable,
  renderMarkdown,
  formatInlineLine,
  renderCodeBlock,
} from './format';
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

// Keep stripAnsi accessible for tests that import from renderer
void stripAnsi;

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
          write(`\r\x1b[K${currentLine}`);
          continue;
        }

        write(`\r\x1b[K`);
        const line = currentLine.slice(0, -1);
        currentLine = '';
        processCompletedLine(line);
      }
    },

    endStream() {
      if (inStream) {
        if (currentLine) {
          write(`\r\x1b[K`);
          const line = currentLine;
          currentLine = '';
          processCompletedLine(line);
        }
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
