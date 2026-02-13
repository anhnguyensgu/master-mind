import { test, expect, describe } from 'bun:test';
import { colors, style, theme, cursor, erase } from './ui/theme';

describe('theme', () => {
  test('colors should be ANSI escape sequences', () => {
    expect(colors.reset).toBe('\x1b[0m');
    expect(colors.red).toBe('\x1b[31m');
    expect(colors.green).toBe('\x1b[32m');
    expect(colors.brightCyan).toBe('\x1b[96m');
  });

  test('style should be ANSI escape sequences', () => {
    expect(style.bold).toBe('\x1b[1m');
    expect(style.dim).toBe('\x1b[2m');
    expect(style.italic).toBe('\x1b[3m');
  });

  test('cursor functions should return ANSI sequences', () => {
    expect(cursor.up(2)).toBe('\x1b[2A');
    expect(cursor.down(3)).toBe('\x1b[3B');
    expect(cursor.moveToColumn(5)).toBe('\x1b[5G');
  });

  test('theme should have semantic color mappings', () => {
    expect(theme.primary).toBe(colors.brightCyan);
    expect(theme.error).toBe(colors.brightRed);
    expect(theme.success).toBe(colors.brightGreen);
    expect(theme.tool).toBe(colors.yellow);
  });
});
