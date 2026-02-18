import { join } from 'path';
import { homedir } from 'os';
import type { LLMProviderName, PermissionsConfig } from './config.types';

const GLOBAL_SETTINGS_PATH = join(homedir(), '.master-mind', 'settings.json');
const PROJECT_SETTINGS_PATH = join(process.cwd(), '.master-mind', 'settings.json');

export interface LLMSettings {
  provider?: LLMProviderName;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
}

export interface Settings {
  llm?: LLMSettings;
  permissions?: PermissionsConfig;
}

async function readSettingsFile(path: string): Promise<Settings> {
  const file = Bun.file(path);
  if (!(await file.exists())) return {};
  return file.json();
}

export async function loadSettings(): Promise<Settings> {
  const [global, project] = await Promise.all([
    readSettingsFile(GLOBAL_SETTINGS_PATH),
    readSettingsFile(PROJECT_SETTINGS_PATH),
  ]);

  return {
    llm: {
      provider: project.llm?.provider ?? global.llm?.provider,
      model: project.llm?.model ?? global.llm?.model,
      baseUrl: project.llm?.baseUrl ?? global.llm?.baseUrl,
      maxTokens: project.llm?.maxTokens ?? global.llm?.maxTokens,
    },
    permissions: {
      allow: [...(global.permissions?.allow ?? []), ...(project.permissions?.allow ?? [])],
      deny: [...(global.permissions?.deny ?? []), ...(project.permissions?.deny ?? [])],
    },
  };
}
