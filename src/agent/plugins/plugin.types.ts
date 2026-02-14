import type { MasterMindConfig } from '../../config/config.types';

export interface PluginSpec {
  path: string;
  options?: Record<string, unknown>;
  enabled?: boolean;
  replace?: boolean;
}

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  hooks?: PluginHooks;
}

export type PluginFactory = (options?: Record<string, unknown>) => Plugin | Promise<Plugin>;

export interface PluginHooks {
  onInit?(context: PluginContext): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
  beforeMessage?(message: string): string | Promise<string>;
  afterResponse?(response: { content: string; stopReason: string }): void | Promise<void>;
}

export interface PluginContext {
  config: MasterMindConfig;
}
