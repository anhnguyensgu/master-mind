import { cursor, erase, theme, colors } from './theme';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

export interface Spinner {
  start(message?: string): void;
  update(message: string): void;
  stop(finalMessage?: string): void;
  isActive(): boolean;
}

export function createSpinner(): Spinner {
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let currentMessage = '';
  let active = false;

  function render() {
    const frame = FRAMES[frameIndex % FRAMES.length]!;
    frameIndex++;
    process.stdout.write(
      `\r${erase.lineEnd}${theme.accent}${frame}${colors.reset} ${theme.muted}${currentMessage}${colors.reset}`
    );
  }

  return {
    start(message = 'Thinking...') {
      if (active) return;
      active = true;
      currentMessage = message;
      frameIndex = 0;
      process.stdout.write(cursor.hide);
      render();
      timer = setInterval(render, INTERVAL_MS);
    },

    update(message: string) {
      currentMessage = message;
    },

    stop(finalMessage?: string) {
      if (!active) return;
      active = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write(`\r${erase.lineEnd}${cursor.show}`);
      if (finalMessage) {
        process.stdout.write(`${finalMessage}\n`);
      }
    },

    isActive() {
      return active;
    },
  };
}
