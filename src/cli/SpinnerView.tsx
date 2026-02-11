import { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

interface SpinnerProps {
  active: boolean;
  message?: string;
}

export function Spinner({ active, message = 'Thinking...' }: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    setFrameIndex(0);
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  const frame = FRAMES[frameIndex % FRAMES.length]!;
  return <Text color="cyan">{frame} <Text dimColor>{message}</Text></Text>;
}
