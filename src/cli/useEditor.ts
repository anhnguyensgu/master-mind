import { useReducer, useRef, useCallback } from 'react';

export const MAX_VISIBLE_LINES = 3;

// ──────────────── State ────────────────

export interface EditorState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  scrollOffset: number;
  history: string[];
  historyIndex: number; // -1 = not browsing
  savedInput: string;
}

export const initialEditorState: EditorState = {
  lines: [''],
  cursorRow: 0,
  cursorCol: 0,
  scrollOffset: 0,
  history: [],
  historyIndex: -1,
  savedInput: '',
};

// ──────────────── Actions ────────────────

export type EditorAction =
  | { type: 'INSERT_CHAR'; char: string }
  | { type: 'BACKSPACE' }
  | { type: 'DELETE' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'HOME' }
  | { type: 'END' }
  | { type: 'NEWLINE' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' };

// ──────────────── Helpers ────────────────

function adjustScroll(cursorRow: number, scrollOffset: number): number {
  if (cursorRow < scrollOffset) {
    return cursorRow;
  } else if (cursorRow >= scrollOffset + MAX_VISIBLE_LINES) {
    return cursorRow - MAX_VISIBLE_LINES + 1;
  }
  return scrollOffset;
}

function browseHistory(state: EditorState, direction: -1 | 1): EditorState {
  const { history, historyIndex, savedInput } = state;
  if (history.length === 0) return state;

  let newIndex = historyIndex;
  let newSavedInput = savedInput;

  if (historyIndex === -1 && direction === -1) {
    newSavedInput = state.lines.join('\n');
    newIndex = history.length - 1;
  } else if (direction === -1 && historyIndex > 0) {
    newIndex = historyIndex - 1;
  } else if (direction === 1 && historyIndex >= 0) {
    newIndex = historyIndex + 1;
    if (newIndex >= history.length) {
      const lines = newSavedInput.split('\n');
      const cursorRow = lines.length - 1;
      return {
        ...state,
        historyIndex: -1,
        savedInput: newSavedInput,
        lines,
        cursorRow,
        cursorCol: lines[cursorRow]!.length,
        scrollOffset: Math.max(0, lines.length - MAX_VISIBLE_LINES),
      };
    }
  } else {
    return state;
  }

  const entry = history[newIndex]!;
  const lines = entry.split('\n');
  const cursorRow = lines.length - 1;
  return {
    ...state,
    historyIndex: newIndex,
    savedInput: newSavedInput,
    lines,
    cursorRow,
    cursorCol: lines[cursorRow]!.length,
    scrollOffset: Math.max(0, lines.length - MAX_VISIBLE_LINES),
  };
}

// ──────────────── Reducer ────────────────

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'INSERT_CHAR': {
      const line = state.lines[state.cursorRow]!;
      const newLines = [...state.lines];
      newLines[state.cursorRow] = line.slice(0, state.cursorCol) + action.char + line.slice(state.cursorCol);
      return { ...state, lines: newLines, cursorCol: state.cursorCol + action.char.length };
    }

    case 'BACKSPACE': {
      if (state.cursorCol > 0) {
        const line = state.lines[state.cursorRow]!;
        const newLines = [...state.lines];
        newLines[state.cursorRow] = line.slice(0, state.cursorCol - 1) + line.slice(state.cursorCol);
        return { ...state, lines: newLines, cursorCol: state.cursorCol - 1 };
      } else if (state.cursorRow > 0) {
        const prevLine = state.lines[state.cursorRow - 1]!;
        const currentLine = state.lines[state.cursorRow]!;
        const newLines = [...state.lines];
        newLines[state.cursorRow - 1] = prevLine + currentLine;
        newLines.splice(state.cursorRow, 1);
        const newRow = state.cursorRow - 1;
        return {
          ...state,
          lines: newLines,
          cursorRow: newRow,
          cursorCol: prevLine.length,
          scrollOffset: adjustScroll(newRow, state.scrollOffset),
        };
      }
      return state;
    }

    case 'DELETE': {
      const line = state.lines[state.cursorRow]!;
      if (state.cursorCol < line.length) {
        const newLines = [...state.lines];
        newLines[state.cursorRow] = line.slice(0, state.cursorCol) + line.slice(state.cursorCol + 1);
        return { ...state, lines: newLines };
      } else if (state.cursorRow < state.lines.length - 1) {
        const newLines = [...state.lines];
        newLines[state.cursorRow] = line + newLines[state.cursorRow + 1]!;
        newLines.splice(state.cursorRow + 1, 1);
        return { ...state, lines: newLines };
      }
      return state;
    }

    case 'MOVE_LEFT': {
      if (state.cursorCol > 0) {
        return { ...state, cursorCol: state.cursorCol - 1 };
      } else if (state.cursorRow > 0) {
        const newRow = state.cursorRow - 1;
        return {
          ...state,
          cursorRow: newRow,
          cursorCol: state.lines[newRow]!.length,
          scrollOffset: adjustScroll(newRow, state.scrollOffset),
        };
      }
      return state;
    }

    case 'MOVE_RIGHT': {
      const line = state.lines[state.cursorRow]!;
      if (state.cursorCol < line.length) {
        return { ...state, cursorCol: state.cursorCol + 1 };
      } else if (state.cursorRow < state.lines.length - 1) {
        const newRow = state.cursorRow + 1;
        return {
          ...state,
          cursorRow: newRow,
          cursorCol: 0,
          scrollOffset: adjustScroll(newRow, state.scrollOffset),
        };
      }
      return state;
    }

    case 'MOVE_UP': {
      if (state.cursorRow > 0) {
        const newRow = state.cursorRow - 1;
        return {
          ...state,
          cursorRow: newRow,
          cursorCol: Math.min(state.cursorCol, state.lines[newRow]!.length),
          scrollOffset: adjustScroll(newRow, state.scrollOffset),
        };
      }
      return browseHistory(state, -1);
    }

    case 'MOVE_DOWN': {
      if (state.cursorRow < state.lines.length - 1) {
        const newRow = state.cursorRow + 1;
        return {
          ...state,
          cursorRow: newRow,
          cursorCol: Math.min(state.cursorCol, state.lines[newRow]!.length),
          scrollOffset: adjustScroll(newRow, state.scrollOffset),
        };
      }
      return browseHistory(state, 1);
    }

    case 'HOME':
      return { ...state, cursorCol: 0 };

    case 'END':
      return { ...state, cursorCol: state.lines[state.cursorRow]!.length };

    case 'NEWLINE': {
      const line = state.lines[state.cursorRow]!;
      const newLines = [...state.lines];
      newLines[state.cursorRow] = line.slice(0, state.cursorCol);
      newLines.splice(state.cursorRow + 1, 0, line.slice(state.cursorCol));
      const newRow = state.cursorRow + 1;
      return {
        ...state,
        lines: newLines,
        cursorRow: newRow,
        cursorCol: 0,
        scrollOffset: adjustScroll(newRow, state.scrollOffset),
      };
    }

    case 'CLEAR':
      return {
        ...state,
        lines: [''],
        cursorRow: 0,
        cursorCol: 0,
        scrollOffset: 0,
      };

    case 'SUBMIT': {
      const text = state.lines.join('\n').trim();
      const newHistory = text ? [...state.history, text] : state.history;
      return {
        ...state,
        lines: [''],
        cursorRow: 0,
        cursorCol: 0,
        scrollOffset: 0,
        history: newHistory,
        historyIndex: -1,
        savedInput: '',
      };
    }
  }
}

// ──────────────── Submitted text helper ────────────────

export function getSubmittedText(prevState: EditorState, newState: EditorState): string | null {
  // Detect a submit: history grew or lines were reset after non-empty content
  if (newState.history.length > prevState.history.length) {
    return newState.history[newState.history.length - 1]!;
  }
  return null;
}

// ──────────────── Hook ────────────────

export function useEditor() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const prevStateRef = useRef(state);

  const dispatchAndTrack = useCallback((action: EditorAction) => {
    prevStateRef.current = state;
    dispatch(action);
  }, [state]);

  return { state, dispatch: dispatchAndTrack, prevStateRef };
}
