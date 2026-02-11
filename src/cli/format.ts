import { colors, style, theme } from './theme';

// ──────────────── ANSI helpers ────────────────

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// ──────────────── Box-drawing table renderer ────────────────

export interface TableData {
  headers: string[];
  rows: string[][];
  colWidths: number[];
}

export function parseMarkdownTable(block: string): TableData | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  const headerLine = lines[0]!;
  const separatorLine = lines[1]!;

  if (!/^\|[\s-:|]+\|$/.test(separatorLine)) return null;

  const parseCells = (line: string) =>
    line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const headers = parseCells(headerLine);
  const rows = lines.slice(2).map(parseCells);

  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow, 3);
  });

  return { headers, rows, colWidths };
}

export function renderTable(table: TableData): string {
  const { headers, rows, colWidths } = table;
  const m = theme.muted;
  const r = colors.reset;

  const pad = (text: string, width: number) => {
    const stripped = stripAnsi(text);
    const padding = Math.max(0, width - stripped.length);
    return text + ' '.repeat(padding);
  };

  const top = `${m}┌${colWidths.map((w) => '─'.repeat(w + 2)).join('┬')}┐${r}`;
  const headerRow = `${m}│${r} ${headers.map((h, i) => `${style.bold}${pad(h, colWidths[i]!)}${r}`).join(` ${m}│${r} `)} ${m}│${r}`;
  const sep = `${m}├${colWidths.map((w) => '─'.repeat(w + 2)).join('┼')}┤${r}`;
  const dataRows = rows.map(
    (row) => `${m}│${r} ${row.map((cell, i) => `${pad(cell, colWidths[i]!)}${r}`).join(` ${m}│${r} `)} ${m}│${r}`,
  );
  const bottom = `${m}└${colWidths.map((w) => '─'.repeat(w + 2)).join('┴')}┘${r}`;

  return [top, headerRow, sep, ...dataRows, bottom].join('\n');
}

// ──────────────── Markdown renderer ────────────────

export function renderMarkdown(text: string): string {
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

export function formatInlineLine(line: string): string {
  let result = line;

  // Headers: # ## ###
  if (/^### .+$/.test(result)) {
    return result.replace(/^### (.+)$/, `   ${style.bold}${theme.secondary}$1${colors.reset}`);
  }
  if (/^## .+$/.test(result)) {
    return result.replace(/^## (.+)$/, `\n  ${style.bold}${theme.primary}$1${colors.reset}`);
  }
  if (/^# .+$/.test(result)) {
    return result.replace(/^# (.+)$/, `\n${style.bold}${style.underline}${theme.primary}$1${colors.reset}`);
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

// ──────────────── Code block renderer ────────────────

export function renderCodeBlock(lines: string[], lang: string): string {
  const width = 60;
  const m = theme.muted;
  const r = colors.reset;
  const langLabel = lang ? ` ${lang} ` : '';
  const topBar = `${m}┌${langLabel}${'─'.repeat(Math.max(0, width - langLabel.length - 2))}┐${r}`;
  const bottomBar = `${m}└${'─'.repeat(width - 2)}┘${r}`;

  const codeLines = lines.map((line) => `${m}│${r} ${theme.code}${line}${r}`);
  return `\n${topBar}\n${codeLines.join('\n')}\n${bottomBar}`;
}

