/**
 * Checks whether required environment conditions for a tool are met.
 * Returns null if all conditions pass, or a human-readable reason string if not.
 */
export async function checkToolRequirements(
  requires: string[] | undefined,
): Promise<string | null> {
  if (!requires || requires.length === 0) return null;

  for (const req of requires) {
    if (req.startsWith('env:')) {
      const varName = req.slice(4);
      if (!process.env[varName]) {
        return `Missing environment variable: ${varName}`;
      }
      continue;
    }

    if (req.startsWith('cli:')) {
      const cmd = req.slice(4);
      const proc = Bun.spawnSync(['which', cmd]);
      if (proc.exitCode !== 0) {
        return `CLI not found on PATH: ${cmd}`;
      }
      continue;
    }

    console.error(`[tool-conditions] Unknown requirement type: "${req}"`);
  }

  return null;
}
