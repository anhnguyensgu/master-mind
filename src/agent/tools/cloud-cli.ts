import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Only these CLIs are allowed
const ALLOWED_CLIS = ['aws', 'gcloud', 'az'] as const;

// Subcommands that are destructive and blocked
const DESTRUCTIVE_SUBCOMMANDS = [
  'delete', 'remove', 'destroy', 'terminate', 'purge',
  'drop', 'kill', 'stop', 'reboot',
  'create', 'update', 'modify', 'put', 'set',
  'attach', 'detach', 'associate', 'disassociate',
  'enable', 'disable', 'start', 'run',
  'apply', 'deploy', 'import', 'restore',
  'deregister', 'release', 'revoke',
];

// Subcommands that are always allowed (read-only)
const SAFE_SUBCOMMANDS = [
  'describe', 'list', 'get', 'show', 'ls',
  'info', 'status', 'check', 'view', 'print',
  'help', 'version',
  'whoami', 'sts', 'caller-identity',
];

const MAX_OUTPUT_LENGTH = 10_000;

export function validateCloudCommand(
  cli: string,
  args: string[],
): string | null {
  if (!ALLOWED_CLIS.includes(cli as typeof ALLOWED_CLIS[number])) {
    return `Only ${ALLOWED_CLIS.join(', ')} CLIs are allowed`;
  }

  // Check if any arg matches destructive subcommands
  const lowerArgs = args.map((a) => a.toLowerCase());

  for (const arg of lowerArgs) {
    // Skip flags
    if (arg.startsWith('-')) continue;

    // Check if this arg is safe first
    const isSafe = SAFE_SUBCOMMANDS.some(
      (safe) => arg === safe || arg.startsWith(`${safe}-`) || arg.endsWith(`-${safe}`),
    );
    if (isSafe) continue;

    // Check if it matches a destructive subcommand
    for (const destructive of DESTRUCTIVE_SUBCOMMANDS) {
      if (arg === destructive || arg.startsWith(`${destructive}-`) || arg.endsWith(`-${destructive}`)) {
        return `Destructive subcommand blocked: "${arg}". Only read-only operations are allowed.`;
      }
    }
  }

  return null;
}

export const cloudCliTool = createTool({
  id: 'cloud_cli',
  description:
    'Run a read-only cloud CLI command (aws, gcloud, or az). Destructive operations (create, delete, modify, etc.) are blocked. Use for inspecting resources, checking configurations, and gathering information.',
  inputSchema: z.object({
    cli: z.enum(['aws', 'gcloud', 'az']).describe('Which cloud CLI to use'),
    args: z.array(z.string()).describe('Arguments to pass to the CLI command'),
    outputFormat: z.enum(['json', 'text', 'table']).optional().describe('Output format (default: json)'),
  }),

  execute: async ({ cli, args, outputFormat }) => {
    console.log('[CLOUD CLI TOOL]', { cli, args, outputFormat });

    const error = validateCloudCommand(cli, args);
    if (error) {
      return { content: error, isError: true };
    }

    // MOCK MODE - return fake output
    return {
      content: `[MOCK] ${cli} ${args.join(' ')}\nExit code: 0\nOutput: (simulated success)`
    };

    /* REAL EXECUTION - commented out for testing
    const format = outputFormat || 'json';
    const fullArgs = [...args];
    if (cli === 'aws' && !args.some((a) => a.startsWith('--output'))) {
      fullArgs.push('--output', format);
    } else if (cli === 'gcloud' && !args.some((a) => a.startsWith('--format'))) {
      fullArgs.push(`--format=${format}`);
    } else if (cli === 'az' && !args.some((a) => a.startsWith('--output'))) {
      fullArgs.push('--output', format);
    }

    try {
      const proc = Bun.spawn([cli, ...fullArgs], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env,
      });

      const timeoutId = setTimeout(() => proc.kill(), 60_000);

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      clearTimeout(timeoutId);
      const exitCode = await proc.exited;

      let output = stdout || '';
      if (stderr && exitCode !== 0) {
        output += (output ? '\n' : '') + stderr;
      }

      if (!output) {
        output = `(no output, exit code: ${exitCode})`;
      }

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...(truncated)';
      }

      return { content: output, isError: exitCode !== 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: `CLI command failed: ${message}`, isError: true };
    }
    */
  },
});
