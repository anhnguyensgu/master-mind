import type { PluginHooks, PluginContext, ToolCallEvent, ToolResultEvent } from './plugin.types';

export interface HookManager {
  register(pluginName: string, hooks: PluginHooks): void;
  runOnInit(context: PluginContext): Promise<void>;
  runOnShutdown(): Promise<void>;
  runBeforeMessage(message: string): Promise<string>;
  runAfterResponse(response: { content: string; stopReason: string }): Promise<void>;
  runBeforeToolCall(event: ToolCallEvent): Promise<ToolCallEvent | null>;
  runAfterToolResult(event: ToolResultEvent): Promise<ToolResultEvent>;
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

    async runBeforeToolCall(event) {
      let current: ToolCallEvent | null = event;
      for (const { hooks } of entries) {
        if (current === null) break;
        if (hooks.beforeToolCall) {
          current = await hooks.beforeToolCall(current);
        }
      }
      return current;
    },

    async runAfterToolResult(event) {
      let current = event;
      for (const { hooks } of entries) {
        if (hooks.afterToolResult) {
          current = await hooks.afterToolResult(current);
        }
      }
      return current;
    },
  };
}
