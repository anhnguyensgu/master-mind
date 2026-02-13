import { resolve, dirname } from 'node:path';
import type { PluginSpec, Plugin, PluginFactory, PluginContext } from './plugin.types';
import type { MasterMindConfig } from '../../config/config.types';
import type { ToolRegistry } from '../tool-registry';
import type { HookManager } from './hook-manager';

export async function loadPluginConfig(
  configPath: string,
): Promise<{ specs: PluginSpec[]; configDir: string }> {
  const exists = await Bun.file(configPath).exists();
  if (!exists) {
    throw new Error(`Plugin config not found: ${configPath}`);
  }

  const mod = await import(configPath);
  const specs = mod.default;

  if (!Array.isArray(specs)) {
    throw new Error(
      `Invalid plugin config at ${configPath}: default export must be a PluginSpec[]`,
    );
  }

  return { specs, configDir: dirname(configPath) };
}

async function resolvePlugin(
  modulePath: string,
  options?: Record<string, unknown>,
): Promise<Plugin> {
  const mod = await import(modulePath);
  const exported = mod.default;

  if (typeof exported === 'function') {
    return await (exported as PluginFactory)(options);
  }

  if (typeof exported === 'object' && exported !== null && typeof exported.name === 'string') {
    return exported as Plugin;
  }

  throw new Error(
    `Plugin at ${modulePath} must default-export a Plugin object or a factory function`,
  );
}

export async function loadPlugins(
  config: MasterMindConfig,
  toolRegistry: ToolRegistry,
  hookManager: HookManager,
): Promise<void> {
  if (!config.pluginConfigPath) return;

  const { specs, configDir } = await loadPluginConfig(config.pluginConfigPath);
  const seenNames = new Set<string>();

  for (const spec of specs) {
    if (spec.enabled === false) continue;

    const modulePath = resolve(configDir, spec.path);
    const plugin = await resolvePlugin(modulePath, spec.options);

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error(`Plugin at ${modulePath} has no valid 'name' field`);
    }
    if (seenNames.has(plugin.name)) {
      throw new Error(`Duplicate plugin name '${plugin.name}' (from ${modulePath})`);
    }
    seenNames.add(plugin.name);

    if (plugin.tools) {
      for (const tool of plugin.tools) {
        if (toolRegistry.has(tool.name) && !spec.replace) {
          throw new Error(
            `Plugin '${plugin.name}' registers tool '${tool.name}' which already exists. Set replace: true in the plugin spec to override.`,
          );
        }
        toolRegistry.register(tool);
      }
    }

    if (plugin.hooks) {
      hookManager.register(plugin.name, plugin.hooks);
    }
  }

  const context: PluginContext = { config, toolRegistry };
  await hookManager.runOnInit(context);
}
