import type { PluginHooks, PluginContext } from './plugin.types';

export interface HookManager {
  register(pluginName: string, hooks: PluginHooks): void;
  runOnInit(context: PluginContext): Promise<void>;
  runOnShutdown(): Promise<void>;
  runBeforeMessage(message: string): Promise<string>;
  runAfterResponse(response: { content: string; stopReason: string }): Promise<void>;
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
  };
}
