import * as readline from 'node:readline';
import { theme, colors } from './theme';

export interface InputHandler {
  prompt(): Promise<string>;
  close(): void;
}

export function createInputHandler(): InputHandler {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  const PROMPT = `${theme.prompt}❯${colors.reset} `;
  const CONTINUATION = `${theme.muted}…${colors.reset} `;

  return {
    prompt(): Promise<string> {
      return new Promise((resolve) => {
        const lines: string[] = [];

        function askLine(promptStr: string) {
          rl.question(promptStr, (answer) => {
            // Multiline: if line ends with \, continue
            if (answer.endsWith('\\')) {
              lines.push(answer.slice(0, -1));
              askLine(CONTINUATION);
            } else {
              lines.push(answer);
              resolve(lines.join('\n').trim());
            }
          });
        }

        askLine(PROMPT);
      });
    },

    close() {
      rl.close();
    },
  };
}
