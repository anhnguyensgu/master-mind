import { useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useEditor, getSubmittedText, MAX_VISIBLE_LINES } from '../useEditor.ts';
import type { EditorState } from '../useEditor.ts';

interface TextInputProps {
  locked: boolean;
  onSubmit: (text: string) => void;
  onQuit: () => void;
}

function Border() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  return <Text dimColor>{'─'.repeat(cols)}</Text>;
}

export function TextInput({ locked, onSubmit, onQuit }: TextInputProps) {
  const { state, dispatch, prevStateRef } = useEditor();
  const stateRef = useRef<EditorState>(state);
  stateRef.current = state;

  // Detect SUBMIT action results
  useEffect(() => {
    const submitted = getSubmittedText(prevStateRef.current, state);
    if (submitted !== null) {
      onSubmit(submitted);
    }
  }, [state, prevStateRef, onSubmit]);

  useInput((input, key) => {
    // Handle backspace - Ghostty and modern terminals send DEL (key.delete)
    if (key.delete || key.backspace) {
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    // Meta+Enter (Shift+Enter in Ghostty) = add newline without submitting
    if (key.meta && (key.return || input === '\r')) {
      dispatch({ type: 'NEWLINE' });
      return;
    }

    // Regular Enter - check for backslash continuation or submit
    if (key.return || input === '\r') {
      const s = stateRef.current;
      const currentLine = s.lines[s.cursorRow]!;
      if (currentLine.endsWith('\\')) {
        // Strip backslash continuation and add newline
        dispatch({ type: 'BACKSPACE' });
        dispatch({ type: 'NEWLINE' });
      } else {
        dispatch({ type: 'SUBMIT' });
      }
      return;
    }

    if (key.leftArrow) { dispatch({ type: 'MOVE_LEFT' }); return; }
    if (key.rightArrow) { dispatch({ type: 'MOVE_RIGHT' }); return; }
    if (key.upArrow) { dispatch({ type: 'MOVE_UP' }); return; }
    if (key.downArrow) { dispatch({ type: 'MOVE_DOWN' }); return; }

    if (key.ctrl && input === 'c') {
      const s = stateRef.current;
      if (s.lines.join('').length > 0) {
        dispatch({ type: 'CLEAR' });
      } else {
        onQuit();
      }
      return;
    }

    if (key.ctrl && input === 'd') {
      const s = stateRef.current;
      if (s.lines.join('').length === 0) {
        onQuit();
      }
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: 'INSERT_CHAR', char: input });
    }
  }, { isActive: !locked });

  if (locked) {
    return (
      <Box flexDirection="column">
        <Border />
        <Text dimColor>  [streaming...]</Text>
        <Border />
      </Box>
    );
  }

  // Render visible lines
  const { lines, cursorRow, cursorCol, scrollOffset } = state;
  const start = scrollOffset;
  const end = Math.min(start + MAX_VISIBLE_LINES, lines.length);
  const visible = lines.slice(start, end);

  const renderedLines = visible.map((line, i) => {
    const absRow = scrollOffset + i;
    const prefix = absRow === 0 ? '❯ ' : '  ';
    const isCursorLine = absRow === cursorRow;

    if (!isCursorLine) {
      return <Text key={absRow}>{prefix}{line}</Text>;
    }

    // Show cursor as inverse character at cursor position
    const before = line.slice(0, cursorCol);
    const cursorChar = cursorCol < line.length ? line[cursorCol]! : ' ';
    const after = line.slice(cursorCol + 1);

    return (
      <Text key={absRow}>
        {prefix}{before}<Text inverse>{cursorChar}</Text>{after}
      </Text>
    );
  });

  // Pad remaining lines if fewer than MAX_VISIBLE_LINES

  return (
    <Box flexDirection="column">
      <Border />
      {renderedLines}
      <Border />
    </Box>
  );
}
