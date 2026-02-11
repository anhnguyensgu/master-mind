export type KeyEvent =
  | { type: 'char'; char: string; ctrl: boolean }
  | { type: 'enter' }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'tab' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'ctrl-c' }
  | { type: 'ctrl-d' }
  | { type: 'ctrl-l' }
  | { type: 'unknown'; raw: Buffer };

/**
 * Parse raw TTY byte sequences into semantic key events.
 * A single data event may contain multiple key sequences (e.g. pasted text).
 */
export function parseKeySequences(data: Buffer): KeyEvent[] {
  const events: KeyEvent[] = [];
  let i = 0;

  while (i < data.length) {
    const byte = data[i]!;

    // Escape sequences: \x1b[ followed by parameters and a final byte
    // e.g. \x1b[A = arrow up, \x1b[3~ = delete
    if (byte === 0x1b) {
      if (i + 1 < data.length && data[i + 1] === 0x5b) {
        const parsed = parseEscapeSequence(data, i + 2);
        if (parsed) {
          events.push(parsed.event);
          i = parsed.next;
          continue;
        }
      }
      events.push({ type: 'unknown', raw: data.subarray(i, i + 1) });
      i++;
      continue;
    }

    switch (byte) {
      case 0x03: events.push({ type: 'ctrl-c' }); i++; continue;
      case 0x04: events.push({ type: 'ctrl-d' }); i++; continue;
      case 0x08: events.push({ type: 'backspace' }); i++; continue;
      case 0x09: events.push({ type: 'tab' }); i++; continue;
      case 0x0a: events.push({ type: 'enter' }); i++; continue;
      case 0x0c: events.push({ type: 'ctrl-l' }); i++; continue;
      case 0x0d: events.push({ type: 'enter' }); i++; continue;
      case 0x7f: events.push({ type: 'backspace' }); i++; continue;
      default: break;
    }

    // Other Ctrl+letter combinations (0x01-0x1a)
    if (byte >= 0x01 && byte <= 0x1a) {
      events.push({ type: 'char', char: String.fromCharCode(byte + 0x60), ctrl: true });
      i++;
      continue;
    }

    // Regular UTF-8 character
    const charResult = readUTF8Char(data, i);
    events.push({ type: 'char', char: charResult.char, ctrl: false });
    i = charResult.next;
  }

  return events;
}

interface ParsedSequence {
  event: KeyEvent;
  next: number;
}

/**
 * Parse an ANSI escape sequence starting after "\x1b[".
 * `start` points to the first byte after the "[".
 */
function parseEscapeSequence(data: Buffer, start: number): ParsedSequence | null {
  let i = start;

  // Collect parameter bytes (digits, semicolons: 0x30-0x3f)
  while (i < data.length && data[i]! >= 0x30 && data[i]! <= 0x3f) {
    i++;
  }

  if (i >= data.length) return null;

  const finalByte = data[i]!;
  const params = data.subarray(start, i).toString();
  i++;

  // Arrow keys: \x1b[A/B/C/D
  if (finalByte === 0x41) return { event: { type: 'up' }, next: i };
  if (finalByte === 0x42) return { event: { type: 'down' }, next: i };
  if (finalByte === 0x43) return { event: { type: 'right' }, next: i };
  if (finalByte === 0x44) return { event: { type: 'left' }, next: i };

  // Home: \x1b[H or \x1b[1~
  if (finalByte === 0x48) return { event: { type: 'home' }, next: i };
  if (finalByte === 0x7e && params === '1') return { event: { type: 'home' }, next: i };

  // End: \x1b[F or \x1b[4~
  if (finalByte === 0x46) return { event: { type: 'end' }, next: i };
  if (finalByte === 0x7e && params === '4') return { event: { type: 'end' }, next: i };

  // Delete: \x1b[3~
  if (finalByte === 0x7e && params === '3') return { event: { type: 'delete' }, next: i };

  return { event: { type: 'unknown', raw: data.subarray(start - 2, i) }, next: i };
}

/** Read a single UTF-8 character from the buffer. */
function readUTF8Char(data: Buffer, start: number): { char: string; next: number } {
  const byte = data[start]!;
  let len = 1;

  if ((byte & 0xe0) === 0xc0) len = 2;
  else if ((byte & 0xf0) === 0xe0) len = 3;
  else if ((byte & 0xf8) === 0xf0) len = 4;

  const end = Math.min(start + len, data.length);
  const char = data.subarray(start, end).toString('utf-8');
  return { char, next: end };
}
