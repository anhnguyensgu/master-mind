import { cursor, erase, theme, colors } from './theme';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

export interface Spinner {
  start(message?: string): void;
  update(message: string): void;
  stop(finalMessage?: string): void;
  isActive(): boolean;
}

export function createSpinner(write?: (text: string) => void): Spinner {
  const output = write ?? ((text: string) => { process.stdout.write(text); });
  let timer: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let currentMessage = '';
  let active = false;

  function render() {
    const frame = FRAMES[frameIndex % FRAMES.length]!;
    frameIndex++;
    output(
      `\r${erase.lineEnd}${theme.accent}${frame}${colors.reset} ${theme.muted}${currentMessage}${colors.reset}`
    );
  }

  return {
    start(message = 'Thinking...') {
      if (active) return;
      active = true;
      currentMessage = message;
      frameIndex = 0;
      output(cursor.hide);
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
      output(`\r${erase.lineEnd}${cursor.show}`);
      if (finalMessage) {
        output(`${finalMessage}\n`);
      }
    },

    isActive() {
      return active;
    },
  };
}
