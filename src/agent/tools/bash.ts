import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Commands that are never allowed (checked against whitespace-collapsed input)
const DENIED_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=',
  ':(){:|:&};:',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init 0',
  'init 6',
  'chmod -r 777 /',
  'chown -r',
  '> /dev/sda',
  'mv /* ',
  'wget -o- | sh',
  'curl | sh',
  'curl | bash',
];

// Patterns that indicate destructive operations (tested against original input)
const DENIED_PATTERNS = [
  /rm\s+(-[rRf]+\s+)+\//,          // rm -rf /
  />\s*\/dev\/[hs]d/,               // write to disk device
  /mkfs\./,                         // format filesystem
  /dd\s+if=/,                       // raw disk write
  /:\s*\(\s*\)\s*\{/,               // fork bomb
  /chmod\s+-R\s+777\s+\//i,         // world-writable root
  /\|\s*(ba)?sh\s*$/,               // pipe to shell
  /--force-with-lease|--force\s/,   // force push (git)
];

const MAX_OUTPUT_LENGTH = 10_000;

export function isCommandDenied(command: string): string | null {
  // Collapse whitespace for string matching
  const normalized = command.trim().toLowerCase().replace(/\s+/g, ' ');
  // Also check with all whitespace removed for things like fork bombs
  const collapsed = normalized.replace(/\s/g, '');

  for (const denied of DENIED_COMMANDS) {
    if (normalized.includes(denied) || collapsed.includes(denied.replace(/\s/g, ''))) {
      return `Command denied: contains "${denied}"`;
    }
  }

  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(command)) {
      return `Command denied: matches dangerous pattern`;
    }
  }

  return null;
}

export const bashTool = createTool({
  id: 'bash',
  description:
    'Execute a shell command. Use for general-purpose operations like checking disk space, listing processes, reading files, etc. Destructive commands are blocked for safety.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  }),

  execute: async ({ context: { command, timeout: timeoutMs } }) => {
    const timeout = timeoutMs || 30_000;

    const denial = isCommandDenied(command);
    if (denial) {
      return { content: denial, isError: true };
    }

    try {
      const proc = Bun.spawn(['bash', '-c', command], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env,
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        proc.kill();
      }, timeout);

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      clearTimeout(timeoutId);
      const exitCode = await proc.exited;

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + `stderr: ${stderr}`;
      if (!output) output = `(no output, exit code: ${exitCode})`;

      // Truncate very long output
      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...(truncated)';
      }

      if (exitCode !== 0) {
        output = `Exit code: ${exitCode}\n${output}`;
      }

      return { content: output, isError: exitCode !== 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: `Command failed: ${message}`, isError: true };
    }
  },
});
