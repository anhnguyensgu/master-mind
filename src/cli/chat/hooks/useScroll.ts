import { useReducer, useCallback, useEffect } from 'react';
import { useStdout } from 'ink';

export interface ScrollState {
  scrollOffset: number;
  contentHeight: number;
  viewportHeight: number;
  autoFollow: boolean;
  hasNewMessages: boolean;
}

type ScrollAction =
  | { type: 'SCROLL_UP'; lines: number }
  | { type: 'SCROLL_DOWN'; lines: number }
  | { type: 'SCROLL_TO_TOP' }
  | { type: 'SCROLL_TO_BOTTOM' }
  | { type: 'SET_CONTENT_HEIGHT'; height: number }
  | { type: 'SET_VIEWPORT_HEIGHT'; height: number }
  | { type: 'CONTENT_APPENDED' };

export const initialScrollState: ScrollState = {
  scrollOffset: 0,
  contentHeight: 0,
  viewportHeight: 0,
  autoFollow: true,
  hasNewMessages: false,
};

function maxScroll(state: ScrollState): number {
  return Math.max(0, state.contentHeight - state.viewportHeight);
}

export function scrollReducer(state: ScrollState, action: ScrollAction): ScrollState {
  switch (action.type) {
    case 'SCROLL_UP': {
      const offset = Math.max(0, state.scrollOffset - action.lines);
      return { ...state, scrollOffset: offset, autoFollow: false };
    }

    case 'SCROLL_DOWN': {
      const max = maxScroll(state);
      const offset = Math.min(max, state.scrollOffset + action.lines);
      const atBottom = offset >= max;
      return {
        ...state,
        scrollOffset: offset,
        autoFollow: atBottom,
        hasNewMessages: atBottom ? false : state.hasNewMessages,
      };
    }

    case 'SCROLL_TO_TOP':
      return { ...state, scrollOffset: 0, autoFollow: false };

    case 'SCROLL_TO_BOTTOM':
      return {
        ...state,
        scrollOffset: maxScroll(state),
        autoFollow: true,
        hasNewMessages: false,
      };

    case 'SET_CONTENT_HEIGHT': {
      const next = { ...state, contentHeight: action.height };
      if (state.autoFollow) {
        next.scrollOffset = maxScroll(next);
      }
      return next;
    }

    case 'SET_VIEWPORT_HEIGHT': {
      if (action.height === state.viewportHeight) return state;
      const next = { ...state, viewportHeight: action.height };
      if (state.autoFollow) {
        next.scrollOffset = maxScroll(next);
      }
      return next;
    }

    case 'CONTENT_APPENDED': {
      if (state.autoFollow) return state;
      return { ...state, hasNewMessages: true };
    }
  }
}

export function useScroll(chromeHeight: number, minViewport: number) {
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  const computeViewport = () => Math.max(minViewport, terminalRows - chromeHeight);

  const [state, dispatch] = useReducer(
    scrollReducer,
    undefined,
    (): ScrollState => ({ ...initialScrollState, viewportHeight: computeViewport() }),
  );

  useEffect(() => {
    dispatch({ type: 'SET_VIEWPORT_HEIGHT', height: computeViewport() });
  }, [terminalRows]);

  const scrollUp = useCallback((lines: number) => dispatch({ type: 'SCROLL_UP', lines }), []);
  const scrollDown = useCallback((lines: number) => dispatch({ type: 'SCROLL_DOWN', lines }), []);
  const scrollToTop = useCallback(() => dispatch({ type: 'SCROLL_TO_TOP' }), []);
  const scrollToBottom = useCallback(() => dispatch({ type: 'SCROLL_TO_BOTTOM' }), []);
  const setContentHeight = useCallback((height: number) => dispatch({ type: 'SET_CONTENT_HEIGHT', height }), []);
  const onContentAppended = useCallback(() => dispatch({ type: 'CONTENT_APPENDED' }), []);

  return {
    state,
    viewportHeight: state.viewportHeight,
    scrollUp,
    scrollDown,
    scrollToTop,
    scrollToBottom,
    setContentHeight,
    onContentAppended,
  };
}
