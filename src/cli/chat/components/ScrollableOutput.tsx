import { useRef, useEffect } from 'react';
import { Box, Text, useInput, measureElement, type DOMElement } from 'ink';
import type { ChatEntry } from '../hooks/useAgent.ts';
import { ChatItemView } from './ChatItemView.tsx';
import { Spinner } from '../../ui/SpinnerView.tsx';
import { useScroll } from '../hooks/useScroll.ts';

interface ScrollableOutputProps {
  chatLog: ChatEntry[];
  streamText: string;
  locked: boolean;
  activeToolName: string | null;
}

// StatusBar(1) + TextInput borders(2) + TextInput visible lines(3) + margin(1)
const CHROME_HEIGHT = 7;
const MIN_VIEWPORT = 5;
const OVERLAP_LINES = 2;

export function ScrollableOutput({ chatLog, streamText, locked, activeToolName }: ScrollableOutputProps) {
  const {
    state,
    viewportHeight,
    scrollUp, scrollDown, scrollToTop, scrollToBottom,
    setContentHeight, onContentAppended,
  } = useScroll(CHROME_HEIGHT, MIN_VIEWPORT);
  const innerRef = useRef<DOMElement>(null);
  const prevLengthRef = useRef(0);
  const prevContentHeightRef = useRef(0);

  useEffect(() => {
    if (chatLog.length > prevLengthRef.current) {
      onContentAppended();
      prevLengthRef.current = chatLog.length;
    }
    if (innerRef.current) {
      const { height } = measureElement(innerRef.current);
      if (height !== prevContentHeightRef.current) {
        prevContentHeightRef.current = height;
        setContentHeight(height);
      }
    }
  }, [chatLog.length, locked, !!streamText]);

  useInput((input, key) => {
    if (key.pageUp || key.pageDown) {
      const scrollStep = viewportHeight - OVERLAP_LINES;
      key.pageUp ? scrollUp(scrollStep) : scrollDown(scrollStep);
    } else if (input === 'home' || (key.ctrl && key.upArrow)) {
      scrollToTop();
    } else if (input === 'end' || (key.ctrl && key.downArrow)) {
      scrollToBottom();
    }
  });

  const { scrollOffset, hasNewMessages } = state;

  return (
    <Box flexDirection="column">
      <Box height={viewportHeight} overflowY="hidden">
        <Box ref={innerRef} flexDirection="column" marginTop={-scrollOffset}>
          {chatLog.map((entry) => (
            <Box key={entry.id}>
              <ChatItemView item={entry.item} />
            </Box>
          ))}
          {locked && (
            <Spinner active={locked} message={activeToolName ? `Running ${activeToolName}...` : 'Thinking...'} />
          )}
          {streamText ? <Text>{streamText}</Text> : null}
        </Box>
      </Box>
      {hasNewMessages && (
        <Text dimColor inverse>{' -- New messages below (Page Down) -- '}</Text>
      )}
    </Box>
  );
}
