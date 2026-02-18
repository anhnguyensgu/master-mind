import { createElement } from 'react';
import { render } from 'ink';
import { loadConfig } from '../config/config';
import type { MasterMindConfig } from '../config/config.types';
import { App } from './App';

async function main() {
  const config = await loadConfig();
  const { waitUntilExit } = render(createElement(App, { config }), { exitOnCtrlC: false });
  await waitUntilExit();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
