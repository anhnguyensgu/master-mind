import { test, expect, describe } from 'bun:test';
import { stripAnsi, parseMarkdownTable } from './format';

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
