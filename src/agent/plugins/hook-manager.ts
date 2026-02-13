import type { PluginHooks, PluginContext } from './plugin.types';
import type { ToolExecutionResult } from '../agent.types';

export interface HookManager {
  register(pluginName: string, hooks: PluginHooks): void;
  runOnInit(context: PluginContext): Promise<void>;
  runOnShutdown(): Promise<void>;
  runBeforeMessage(message: string): Promise<string>;
  runAfterResponse(response: { content: string; stopReason: string }): Promise<void>;
  runBeforeToolExecute(
    name: string,
    input: Record<string, unknown>,
  ): Promise<{ name: string; input: Record<string, unknown> } | null>;
  runAfterToolExecute(
    name: string,
    input: Record<string, unknown>,
    result: ToolExecutionResult,
  ): Promise<ToolExecutionResult>;
}

export function createHookManager(): HookManager {
  const entries: Array<{ pluginName: string; hooks: PluginHooks }> = [];

  return {
    register(pluginName, hooks) {
      entries.push({ pluginName, hooks });
    },

    async runOnInit(context) {
      for (const { hooks } of entries) {
        if (hooks.onInit) await hooks.onInit(context);
      }
    },

    async runOnShutdown() {
      for (let i = entries.length - 1; i >= 0; i--) {
        const { hooks } = entries[i]!;
        if (hooks.onShutdown) {
          try {
            await hooks.onShutdown();
          } catch {
            // best-effort: continue shutting down other plugins
          }
        }
      }
    },

    async runBeforeMessage(message) {
      let current = message;
      for (const { hooks } of entries) {
        if (hooks.beforeMessage) {
          current = await hooks.beforeMessage(current);
        }
      }
      return current;
    },

    async runAfterResponse(response) {
      for (const { hooks } of entries) {
        if (hooks.afterResponse) await hooks.afterResponse(response);
      }
    },

    async runBeforeToolExecute(name, input) {
      let current: { name: string; input: Record<string, unknown> } | null = { name, input };
      for (const { hooks } of entries) {
        if (current === null) break;
        if (hooks.beforeToolExecute) {
          current = await hooks.beforeToolExecute(current.name, current.input);
        }
      }
      return current;
    },

    async runAfterToolExecute(name, input, result) {
      let current = result;
      for (const { hooks } of entries) {
        if (hooks.afterToolExecute) {
          current = await hooks.afterToolExecute(name, input, current);
        }
      }
      return current;
    },
  };
}
