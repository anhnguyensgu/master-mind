import type { MasterMindConfig } from '../../config/config.types';
import type { Tool } from '@mastra/core/tools';

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
  tools?: Record<string, Tool>;
}

export type PluginFactory = (options?: Record<string, unknown>) => Plugin | Promise<Plugin>;

export interface ToolCallEvent {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  toolName: string;
  toolCallId: string;
  result: { content: string; isError: boolean };
  durationMs: number;
}

export interface PluginHooks {
  onInit?(context: PluginContext): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
  beforeMessage?(message: string): string | Promise<string>;
  afterResponse?(response: { content: string; stopReason: string }): void | Promise<void>;
  beforeToolCall?(event: ToolCallEvent): ToolCallEvent | null | Promise<ToolCallEvent | null>;
  afterToolResult?(event: ToolResultEvent): ToolResultEvent | Promise<ToolResultEvent>;
}

export interface PluginContext {
  config: MasterMindConfig;
}
