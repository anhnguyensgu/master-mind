import type { AgentTool, ToolExecutionResult } from '../agent.types';
import type { ToolRegistry } from '../tool-registry';
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
  tools?: AgentTool[];
  hooks?: PluginHooks;
}

export type PluginFactory = (options?: Record<string, unknown>) => Plugin | Promise<Plugin>;

export interface PluginHooks {
  onInit?(context: PluginContext): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
  beforeMessage?(message: string): string | Promise<string>;
  afterResponse?(response: { content: string; stopReason: string }): void | Promise<void>;
  beforeToolExecute?(
    name: string,
    input: Record<string, unknown>,
  ): { name: string; input: Record<string, unknown> } | null | Promise<{ name: string; input: Record<string, unknown> } | null>;
  afterToolExecute?(
    name: string,
    input: Record<string, unknown>,
    result: ToolExecutionResult,
  ): ToolExecutionResult | Promise<ToolExecutionResult>;
}

export interface PluginContext {
  config: MasterMindConfig;
  toolRegistry: ToolRegistry;
}
