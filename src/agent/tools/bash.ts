import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { PermissionsConfig } from '../../config/config.types';

// Default commands allowed without any user config (read-only, safe operations)
export const DEFAULT_ALLOWED_COMMANDS = [
  // File inspection
  'ls', 'cat', 'head', 'tail', 'wc', 'file', 'stat', 'find', 'tree',
  // Text processing
  'grep', 'rg', 'awk', 'sed', 'sort', 'uniq', 'cut', 'tr', 'diff', 'jq',
  // System info
  'ps', 'top', 'htop', 'df', 'du', 'free', 'uname', 'uptime', 'whoami', 'id', 'hostname',
  // Network (read-only)
  'ping', 'dig', 'nslookup', 'host', 'curl', 'wget', 'netstat', 'ss',
  // Dev tools
  'git', 'which', 'echo', 'date', 'env', 'printenv', 'pwd',
  'bun', 'node', 'npm', 'npx', 'python', 'python3', 'pip',
];

// Safety-net patterns that block even whitelisted commands
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

export function createCommandSets(permissions?: PermissionsConfig): {
  allowed: Set<string>;
  denied: Set<string>;
} {
  const allowed = new Set([...DEFAULT_ALLOWED_COMMANDS, ...(permissions?.allow ?? [])]);
  const denied = new Set(permissions?.deny ?? []);
  // Remove denied from allowed
  for (const cmd of denied) allowed.delete(cmd);
  return { allowed, denied };
}

export function isCommandAllowed(
  command: string,
  allowed: Set<string>,
  denied: Set<string>,
): string | null {
  // Check pipes — each piped segment's first token must be in the allowed set
  const segments = command.split(/\|/).map(s => s.trim());
  for (const segment of segments) {
    const token = segment.split(/\s+/)[0];
    if (!token) continue;
    if (denied.has(token)) {
      return `Command denied: "${token}" is in your deny list.`;
    }
    if (!allowed.has(token)) {
      return `Command not allowed: "${token}". Add it to ~/.master-mind/settings.json permissions.allow to permit.`;
    }
  }

  // Safety-net: block dangerous patterns even if base command is whitelisted
  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(command)) {
      return 'Command denied: matches dangerous pattern';
    }
  }

  return null;
}

export function createBashTool(permissions?: PermissionsConfig) {
  const { allowed, denied } = createCommandSets(permissions);

  return createTool({
    id: 'bash',
    description:
      'Execute a shell command. Only whitelisted commands are allowed. Use cloud_cli tool for aws/gcloud/az commands.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
    }),

    execute: async ({ command, timeout: timeoutMs }) => {
      const timeout = timeoutMs || 30_000;

      const denial = isCommandAllowed(command, allowed, denied);
      if (denial) {
        return { content: denial, isError: true };
      }

      // MOCK MODE - return fake output without executing
      return {
        content: `[MOCK] Command would execute: ${command}\nExit code: 0\nOutput: (simulated success)`
      };

      /* REAL EXECUTION - commented out for testing
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
      */
    },
  });
}

// Backward compat: default export with no user config
export const bashTool = createBashTool();
