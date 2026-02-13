# Plugin Mechanism Design

## Overview

A plugin system that allows extending Master Mind with custom **tools** and **lifecycle hooks** via external `.ts` files, configured through a typed config file.

## Scope

| Extension Point | Description |
|---|---|
| **Tools** | Third-party `AgentTool` implementations loaded from external files |
| **Lifecycle Hooks** | Pipeline-based interceptors for messages and tool execution |

- **Distribution**: Local `.ts/.js` files (leveraging Bun's native `.ts` import)
- **Configuration**: A typed `master-mind.plugins.ts` config file at project root

## Plugin Interface

A plugin is a `.ts` module that default-exports a `Plugin` object (or a factory function receiving options):

```typescript
interface Plugin {
  name: string;
  version?: string;
  description?: string;
  tools?: AgentTool[];
  hooks?: PluginHooks;
}

// Alternative: factory function for plugins that need options
type PluginFactory = (options?: Record<string, unknown>) => Plugin | Promise<Plugin>;
```

## Hook System

Hooks follow a **pipeline** pattern — they run in registration order, each passing its output to the next.

```typescript
interface PluginHooks {
  // Lifecycle
  onInit?(context: PluginContext): void | Promise<void>;
  onShutdown?(): void | Promise<void>;

  // Message hooks
  beforeMessage?(message: string): string | Promise<string>;
  afterResponse?(response: { content: string; stopReason: string }): void | Promise<void>;

  // Tool hooks
  beforeToolExecute?(
    name: string,
    input: Record<string, unknown>,
  ): { name: string; input: Record<string, unknown> } | null | Promise<...>;

  afterToolExecute?(
    name: string,
    input: Record<string, unknown>,
    result: ToolExecutionResult,
  ): ToolExecutionResult | Promise<ToolExecutionResult>;
}
```

| Hook | Type | Behavior |
|---|---|---|
| `onInit` | lifecycle | Called after all plugins load, receives config + tool registry |
| `onShutdown` | lifecycle | Called on exit, runs in **reverse** order (LIFO) |
| `beforeMessage` | transform | Can modify user input before it reaches the LLM |
| `afterResponse` | observe | Read-only notification after LLM responds |
| `beforeToolExecute` | transform/gate | Can modify tool input or return `null` to **block** execution |
| `afterToolExecute` | transform | Can modify tool output (e.g., redact secrets) |

## Configuration

### Config file: `master-mind.plugins.ts`

```typescript
import type { PluginConfig } from './src/agent/plugins/plugin.types';

export default {
  plugins: [
    { path: './plugins/audit-logger.ts' },
    { path: './plugins/kubectl-tool.ts', options: { namespace: 'prod' } },
    { path: './plugins/experimental.ts', enabled: false }, // skipped
  ],
} satisfies PluginConfig;
```

### Config entry shape

```typescript
interface PluginEntry {
  path: string;                        // relative to config file directory
  options?: Record<string, unknown>;   // passed to factory function
  enabled?: boolean;                   // defaults to true
}
```

The config file path defaults to `./master-mind.plugins.ts` and can be overridden via the `MASTER_MIND_PLUGIN_CONFIG` env var.

## Example Plugins

### Hook plugin: audit logger

```typescript
// plugins/audit-logger.ts
import type { Plugin } from '../src/agent/plugins/plugin.types';

const plugin: Plugin = {
  name: 'audit-logger',
  hooks: {
    onInit(ctx) {
      console.log(`[audit] Tools: ${ctx.toolRegistry.list().join(', ')}`);
    },
    beforeToolExecute(name, input) {
      console.log(`[audit] tool=${name} input=${JSON.stringify(input)}`);
      return { name, input }; // pass through
    },
    afterToolExecute(name, _input, result) {
      console.log(`[audit] tool=${name} error=${result.isError ?? false}`);
      return result; // pass through
    },
  },
};

export default plugin;
```

### Tool plugin: kubectl (with factory)

```typescript
// plugins/kubectl-tool.ts
import type { Plugin } from '../src/agent/plugins/plugin.types';

export default function(options?: Record<string, unknown>): Plugin {
  const namespace = (options?.namespace as string) || 'default';

  return {
    name: 'kubectl',
    tools: [{
      name: 'kubectl_get',
      description: `Run kubectl get in the '${namespace}' namespace`,
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'Resource type (pods, services, deployments)' },
        },
        required: ['resource'],
      },
      async execute(input) {
        const proc = Bun.spawn(['kubectl', 'get', input.resource as string, '-n', namespace], {
          stdout: 'pipe', stderr: 'pipe',
        });
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        return { content: stdout, isError: exitCode !== 0 };
      },
    }],
  };
}
```

## Architecture

### New files

| File | Purpose |
|---|---|
| `src/agent/plugins/plugin.types.ts` | Core types: `Plugin`, `PluginHooks`, `PluginConfig`, `PluginContext` |
| `src/agent/plugins/hook-manager.ts` | `createHookManager()` — stores and executes hook pipelines |
| `src/agent/plugins/plugin-loader.ts` | `loadPluginConfig()`, `loadPlugins()` — discovery, import, validation |
| `src/agent/plugins/plugins.test.ts` | Unit tests for hook manager and plugin loader |

### Modified files

| File | Change |
|---|---|
| `src/config/config.types.ts` | Add `pluginConfigPath?: string` to `MasterMindConfig` |
| `src/config/config.ts` | Read `MASTER_MIND_PLUGIN_CONFIG` env var |
| `src/agent/tool-registry.ts` | `createToolRegistry(hookManager?)` — call `beforeToolExecute`/`afterToolExecute` in `execute()` |
| `src/agent/agent.ts` | Add `hookManager?` to `AgentDeps`, call `beforeMessage`/`afterResponse` in `handleMessage()` |
| `src/cli/chat/agentFactory.ts` | Make `buildAgent` async, load plugins, wire hook manager |
| `src/cli/chat/hooks/useAgent.ts` | Handle async `buildAgent` |

### Data flow

```
master-mind.plugins.ts
  │
  ▼
loadPluginConfig() → loadPlugins()
  │                       │
  │    ┌──────────────────┘
  │    │
  ▼    ▼
HookManager ◄── plugin.hooks
  │
  ├──► ToolRegistry.execute()  (beforeToolExecute / afterToolExecute)
  │
  └──► Agent.handleMessage()   (beforeMessage / afterResponse)

ToolRegistry ◄── plugin.tools  (registered alongside built-in tools)
```

## Design Decisions

1. **Optional `hookManager` parameter** — `createToolRegistry()` and `createAgent()` accept an optional hook manager. Existing code works unchanged when no plugins are loaded.

2. **`null` to block tool execution** — `beforeToolExecute` returning `null` signals an intentional block (rather than throwing), giving the agent a clean error message to relay to the LLM.

3. **Plugin paths relative to config file** — Not `cwd`, avoiding ambiguity when running from different directories.

4. **Duplicate name rejection** — Plugin loader rejects two plugins with the same `name` to prevent silent tool overwrites.

5. **No hot-reloading** — Plugins load once at startup. Keeps the system simple and predictable.
