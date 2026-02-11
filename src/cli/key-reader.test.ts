import { test, expect, describe } from 'bun:test';
import { parseKeySequences } from './key-reader';
import type { KeyEvent } from './key-reader';

function parse(bytes: number[]): KeyEvent[] {
  return parseKeySequences(Buffer.from(bytes));
}

function parseStr(str: string): KeyEvent[] {
  return parseKeySequences(Buffer.from(str));
}

describe('parseKeySequences', () => {
  describe('control characters', () => {
    test('Enter (0x0d)', () => {
      expect(parse([0x0d])).toEqual([{ type: 'enter' }]);
    });

    test('Newline (0x0a)', () => {
      expect(parse([0x0a])).toEqual([{ type: 'enter' }]);
    });

    test('Ctrl+C (0x03)', () => {
      expect(parse([0x03])).toEqual([{ type: 'ctrl-c' }]);
    });

    test('Ctrl+D (0x04)', () => {
      expect(parse([0x04])).toEqual([{ type: 'ctrl-d' }]);
    });

    test('Ctrl+L (0x0c)', () => {
      expect(parse([0x0c])).toEqual([{ type: 'ctrl-l' }]);
    });

    test('Tab (0x09)', () => {
      expect(parse([0x09])).toEqual([{ type: 'tab' }]);
    });

    test('Backspace (0x7f)', () => {
      expect(parse([0x7f])).toEqual([{ type: 'backspace' }]);
    });

    test('Backspace alt (0x08)', () => {
      expect(parse([0x08])).toEqual([{ type: 'backspace' }]);
    });
  });

  describe('arrow keys', () => {
    test('Up', () => {
      expect(parse([0x1b, 0x5b, 0x41])).toEqual([{ type: 'up' }]);
    });

    test('Down', () => {
      expect(parse([0x1b, 0x5b, 0x42])).toEqual([{ type: 'down' }]);
    });

    test('Right', () => {
      expect(parse([0x1b, 0x5b, 0x43])).toEqual([{ type: 'right' }]);
    });

    test('Left', () => {
      expect(parse([0x1b, 0x5b, 0x44])).toEqual([{ type: 'left' }]);
    });
  });

  describe('special keys', () => {
    test('Home (\\x1b[H)', () => {
      expect(parse([0x1b, 0x5b, 0x48])).toEqual([{ type: 'home' }]);
    });

    test('Home (\\x1b[1~)', () => {
      expect(parse([0x1b, 0x5b, 0x31, 0x7e])).toEqual([{ type: 'home' }]);
    });

    test('End (\\x1b[F)', () => {
      expect(parse([0x1b, 0x5b, 0x46])).toEqual([{ type: 'end' }]);
    });

    test('End (\\x1b[4~)', () => {
      expect(parse([0x1b, 0x5b, 0x34, 0x7e])).toEqual([{ type: 'end' }]);
    });

    test('Delete (\\x1b[3~)', () => {
      expect(parse([0x1b, 0x5b, 0x33, 0x7e])).toEqual([{ type: 'delete' }]);
    });
  });

  describe('regular characters', () => {
    test('ASCII letter', () => {
      expect(parseStr('a')).toEqual([{ type: 'char', char: 'a', ctrl: false }]);
    });

    test('multiple ASCII characters', () => {
      expect(parseStr('hi')).toEqual([
        { type: 'char', char: 'h', ctrl: false },
        { type: 'char', char: 'i', ctrl: false },
      ]);
    });

    test('UTF-8 emoji (4 bytes)', () => {
      const events = parseKeySequences(Buffer.from('🎉'));
      expect(events).toEqual([{ type: 'char', char: '🎉', ctrl: false }]);
    });

    test('UTF-8 CJK character (3 bytes)', () => {
      const events = parseKeySequences(Buffer.from('你'));
      expect(events).toEqual([{ type: 'char', char: '你', ctrl: false }]);
    });
  });

  describe('Ctrl+letter', () => {
    test('Ctrl+A (0x01)', () => {
      expect(parse([0x01])).toEqual([{ type: 'char', char: 'a', ctrl: true }]);
    });

    test('Ctrl+E (0x05)', () => {
      expect(parse([0x05])).toEqual([{ type: 'char', char: 'e', ctrl: true }]);
    });
  });

  describe('mixed sequences (paste)', () => {
    test('multiple keys in one buffer', () => {
      // 'a' then Enter then 'b'
      const events = parse([0x61, 0x0d, 0x62]);
      expect(events).toEqual([
        { type: 'char', char: 'a', ctrl: false },
        { type: 'enter' },
        { type: 'char', char: 'b', ctrl: false },
      ]);
    });

    test('arrow key followed by character', () => {
      // Up arrow then 'x'
      const events = parse([0x1b, 0x5b, 0x41, 0x78]);
      expect(events).toEqual([
        { type: 'up' },
        { type: 'char', char: 'x', ctrl: false },
      ]);
    });
  });

  describe('unknown sequences', () => {
    test('bare escape', () => {
      const events = parse([0x1b]);
      expect(events[0]!.type).toBe('unknown');
    });
  });
});
