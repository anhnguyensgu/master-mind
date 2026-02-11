import { test, expect, describe } from 'bun:test';
import {
  stripAnsi,
  parseMarkdownTable,
  renderTable,
  formatInlineLine,
  renderCodeBlock,
} from './format';

describe('stripAnsi', () => {
  test('should remove ANSI color codes', () => {
    expect(stripAnsi('\x1b[31mhello\x1b[0m')).toBe('hello');
  });

  test('should handle text without ANSI codes', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  test('should handle empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  test('should remove multiple ANSI codes', () => {
    expect(stripAnsi('\x1b[1m\x1b[96mbold cyan\x1b[0m')).toBe('bold cyan');
  });
});

describe('parseMarkdownTable', () => {
  test('should parse a simple table', () => {
    const input = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = parseMarkdownTable(input);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['A', 'B']);
    expect(result!.rows).toEqual([['1', '2']]);
  });

  test('should return null for non-table input', () => {
    expect(parseMarkdownTable('just text')).toBeNull();
  });

  test('should return null for single line', () => {
    expect(parseMarkdownTable('| A |')).toBeNull();
  });

  test('should return null for missing separator', () => {
    expect(parseMarkdownTable('| A |\n| B |')).toBeNull();
  });

  test('should calculate column widths correctly', () => {
    const input = '| Short | LongerColumn |\n|---|---|\n| x | y |';
    const result = parseMarkdownTable(input);
    expect(result).not.toBeNull();
    expect(result!.colWidths[0]).toBe(5);  // "Short"
    expect(result!.colWidths[1]).toBe(12); // "LongerColumn"
  });
});

describe('renderTable', () => {
  test('should produce box-drawing output', () => {
    const table = { headers: ['A', 'B'], rows: [['1', '2']], colWidths: [3, 3] };
    const output = renderTable(table);
    const plain = stripAnsi(output);
    expect(plain).toContain('┌');
    expect(plain).toContain('┘');
    expect(plain).toContain('│');
    expect(plain).toContain('A');
    expect(plain).toContain('1');
  });
});

describe('formatInlineLine', () => {
  test('should format h1 headers', () => {
    const result = stripAnsi(formatInlineLine('# Title'));
    expect(result).toContain('Title');
  });

  test('should format h2 headers', () => {
    const result = stripAnsi(formatInlineLine('## Subtitle'));
    expect(result).toContain('Subtitle');
  });

  test('should format h3 headers', () => {
    const result = stripAnsi(formatInlineLine('### Section'));
    expect(result).toContain('Section');
  });

  test('should format bullet lists', () => {
    const result = stripAnsi(formatInlineLine('- item'));
    expect(result).toContain('•');
    expect(result).toContain('item');
  });

  test('should format numbered lists', () => {
    const result = stripAnsi(formatInlineLine('1. first'));
    expect(result).toContain('1.');
    expect(result).toContain('first');
  });

  test('should format horizontal rules', () => {
    const result = stripAnsi(formatInlineLine('---'));
    expect(result).toContain('─');
  });

  test('should pass through plain text unchanged', () => {
    expect(stripAnsi(formatInlineLine('hello world'))).toBe('hello world');
  });
});

describe('renderCodeBlock', () => {
  test('should wrap code in box-drawing borders', () => {
    const result = stripAnsi(renderCodeBlock(['const x = 1;'], 'ts'));
    expect(result).toContain('┌');
    expect(result).toContain('ts');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('└');
  });

  test('should handle empty language', () => {
    const result = stripAnsi(renderCodeBlock(['line'], ''));
    expect(result).toContain('┌');
    expect(result).not.toContain('  ┌'); // no extra lang padding
  });
});
