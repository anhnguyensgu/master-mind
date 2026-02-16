// ──────────────── ANSI helpers ────────────────

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

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
