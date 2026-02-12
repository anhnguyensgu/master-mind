import { test, expect, describe } from 'bun:test';
import { createSpinner } from './spinner';
import { colors, style, theme, cursor, erase } from './theme';

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

describe('spinner', () => {
  test('should create spinner with correct interface', () => {
    const spinner = createSpinner();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.update).toBe('function');
    expect(typeof spinner.isActive).toBe('function');
  });

  test('isActive should track state', () => {
    const spinner = createSpinner();
    expect(spinner.isActive()).toBe(false);
    spinner.start('test');
    expect(spinner.isActive()).toBe(true);
    spinner.stop();
    expect(spinner.isActive()).toBe(false);
  });

  test('stop should be safe to call when not active', () => {
    const spinner = createSpinner();
    expect(() => spinner.stop()).not.toThrow();
  });

  test('start should be idempotent', () => {
    const spinner = createSpinner();
    spinner.start('test');
    spinner.start('test again'); // should not double-start
    expect(spinner.isActive()).toBe(true);
    spinner.stop();
  });
});
