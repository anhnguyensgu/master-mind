import { createElement } from 'react';
import { render } from 'ink';
import { loadConfig } from '../config/config';
import type { MasterMindConfig } from '../config/config.types';
import { App } from './App';

// ──────────────── TUI mode (interactive TTY) ────────────────

async function runTUI(config: MasterMindConfig) {
  const { waitUntilExit } = render(createElement(App, { config }), { exitOnCtrlC: false });
  await waitUntilExit();
}

// ──────────────── Entry point ────────────────

async function main() {
  const config = loadConfig();
  await runTUI(config);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
