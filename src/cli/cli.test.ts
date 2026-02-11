import { test, expect, describe } from 'bun:test';
import { createRenderer } from './renderer';
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

describe('renderer', () => {
  test('should create renderer with correct interface', () => {
    const renderer = createRenderer();
    expect(typeof renderer.banner).toBe('function');
    expect(typeof renderer.help).toBe('function');
    expect(typeof renderer.streamText).toBe('function');
    expect(typeof renderer.endStream).toBe('function');
    expect(typeof renderer.toolStart).toBe('function');
    expect(typeof renderer.toolEnd).toBe('function');
    expect(typeof renderer.toolError).toBe('function');
    expect(typeof renderer.error).toBe('function');
    expect(typeof renderer.info).toBe('function');
    expect(typeof renderer.warning).toBe('function');
    expect(typeof renderer.success).toBe('function');
    expect(typeof renderer.usage).toBe('function');
    expect(typeof renderer.divider).toBe('function');
    expect(typeof renderer.markdown).toBe('function');
    expect(typeof renderer.newline).toBe('function');
  });

  test('should handle stream lifecycle without errors', () => {
    const renderer = createRenderer();
    expect(() => {
      renderer.streamText('hello');
      renderer.streamText(' world');
      renderer.endStream();
    }).not.toThrow();
  });

  test('endStream should be safe when not streaming', () => {
    const renderer = createRenderer();
    expect(() => renderer.endStream()).not.toThrow();
  });

  test('should render tool events without errors', () => {
    const renderer = createRenderer();
    expect(() => {
      renderer.toolStart('test_tool', { key: 'value' });
      renderer.toolEnd('test_tool', 150);
      renderer.toolError('test_tool', 'something went wrong');
    }).not.toThrow();
  });

  test('should render usage without errors', () => {
    const renderer = createRenderer();
    expect(() => {
      renderer.usage({ inputTokens: 1000, outputTokens: 500 });
    }).not.toThrow();
  });

  test('should truncate long tool inputs in display', () => {
    const renderer = createRenderer();
    // Shouldn't throw even with very long input
    expect(() => {
      renderer.toolStart('test', { longKey: 'x'.repeat(200) });
    }).not.toThrow();
  });
});
