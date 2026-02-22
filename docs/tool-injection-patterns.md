# Tool Injection Patterns — Brainstorm

This document catalogs potential patterns for injecting, composing, and managing tools in the master-mind agent system. Each pattern is assessed against the existing architecture (`agentFactory.ts`, plugin system, provider registry) with concrete code sketches.

---

## Status Quo

Tools are currently **statically wired** in `agentFactory.ts`:

```ts
const tools = {
  cost_query: costQueryTool,
  cost_summary: costSummaryTool,
  // ... hardcoded list
};
```

Plugins can hook into the message lifecycle (`beforeMessage`, `afterResponse`) but **cannot contribute tools**. The cost provider registry demonstrates a dynamic registration pattern, but it's isolated to cost providers—not agent tools.

---

## Pattern 1: Plugin-Provided Tools

**Concept**: Extend the `Plugin` interface so plugins can export tools alongside hooks.

```ts
// plugin.types.ts
export interface Plugin {
  name: string;
  version?: string;
  hooks?: PluginHooks;
  tools?: Record<string, MastraTool>;   // <-- new
}
```

**Agent factory change**:

```ts
// agentFactory.ts
const pluginTools: Record<string, MastraTool> = {};
for (const plugin of loadedPlugins) {
  if (plugin.tools) {
    for (const [id, tool] of Object.entries(plugin.tools)) {
      if (pluginTools[id] && !spec.replace) {
        throw new Error(`Tool "${id}" already registered (from plugin "${plugin.name}")`);
      }
      pluginTools[id] = tool;
    }
  }
}

const allTools = { ...builtinTools, ...pluginTools };
```

**Pros**: Minimal surface change, leverages existing plugin loading. Plugins become the canonical extension point for both behavior hooks and new capabilities.

**Cons**: Plugins must depend on `@mastra/core/tools` to define tools. No fine-grained control over tool ordering or priority.

---

## Pattern 2: Tool Registry

**Concept**: A central `ToolRegistry` (modeled on `CostProviderRegistry`) that tools register into. The agent factory reads from the registry instead of hardcoding.

```ts
// tool-registry.ts
export class ToolRegistry {
  private tools = new Map<string, MastraTool>();
  private metadata = new Map<string, ToolMeta>();

  register(id: string, tool: MastraTool, meta?: ToolMeta): void {
    if (this.tools.has(id)) {
      throw new Error(`Tool "${id}" already registered`);
    }
    this.tools.set(id, tool);
    if (meta) this.metadata.set(id, meta);
  }

  override(id: string, tool: MastraTool): void {
    this.tools.set(id, tool);
  }

  get(id: string): MastraTool | undefined {
    return this.tools.get(id);
  }

  all(): Record<string, MastraTool> {
    return Object.fromEntries(this.tools);
  }

  list(): string[] {
    return [...this.tools.keys()];
  }
}

interface ToolMeta {
  group?: string;        // "cost", "cloud", "system"
  provider?: string;     // plugin or module that registered it
  requires?: string[];   // config keys or env vars this tool needs
}
```

**Agent factory change**:

```ts
const registry = new ToolRegistry();

// Built-in tools register themselves
registry.register('bash', createBashTool(config.permissions));
registry.register('cloud_cli', cloudCliTool);
// ...

// Plugins can register additional tools
await loadPlugins(config, hookManager, registry);

const mastraAgent = new MastraAgent({
  tools: registry.all(),
});
```

**Pros**: Single source of truth for tool inventory. Supports override, metadata, and introspection. Easy to list available tools for the system prompt.

**Cons**: Another abstraction layer. Need to thread the registry through plugin loading.

---

## Pattern 3: Tool Middleware / Decorators

**Concept**: Wrap tools with cross-cutting concerns (logging, caching, auth checks, rate limiting) using a decorator/middleware pattern.

```ts
// tool-middleware.ts
type ToolMiddleware = (
  tool: MastraTool,
  context: ToolExecutionContext,
) => MastraTool;

function withLogging(tool: MastraTool): MastraTool {
  const original = tool.execute;
  return {
    ...tool,
    execute: async (input) => {
      const start = Date.now();
      console.log(`[tool:${tool.id}] start`, JSON.stringify(input));
      const result = await original(input);
      console.log(`[tool:${tool.id}] done (${Date.now() - start}ms)`);
      return result;
    },
  };
}

function withCache(tool: MastraTool, ttlMs: number): MastraTool {
  const cache = new Map<string, { result: unknown; expires: number }>();
  const original = tool.execute;
  return {
    ...tool,
    execute: async (input) => {
      const key = JSON.stringify(input);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.result;
      const result = await original(input);
      cache.set(key, { result, expires: Date.now() + ttlMs });
      return result;
    },
  };
}

function withRateLimit(tool: MastraTool, maxPerMinute: number): MastraTool {
  const timestamps: number[] = [];
  const original = tool.execute;
  return {
    ...tool,
    execute: async (input) => {
      const now = Date.now();
      while (timestamps.length && timestamps[0]! < now - 60_000) timestamps.shift();
      if (timestamps.length >= maxPerMinute) {
        return { content: `Rate limit: max ${maxPerMinute} calls/min`, isError: true };
      }
      timestamps.push(now);
      return original(input);
    },
  };
}
```

**Usage in agent factory**:

```ts
const costQuery = withCache(
  withLogging(createCostQueryTool(config.costApi)),
  5 * 60_000, // cache for 5 minutes
);
```

**Pros**: Non-invasive, composable. Each concern is independently testable. Can be applied selectively per-tool.

**Cons**: Wrapper nesting can obscure the original tool. Type safety can erode across wrappers. Need to preserve `inputSchema` and `description` correctly.

---

## Pattern 4: Config-Driven Tool Loading

**Concept**: Define available tools in a config file (JSON/TS). The agent factory dynamically imports and instantiates only the tools listed.

```jsonc
// ~/.master-mind/tools.json
{
  "tools": [
    { "id": "bash", "module": "@master-mind/tools/bash", "enabled": true },
    { "id": "cost_query", "module": "@master-mind/tools/cost-query", "enabled": true },
    { "id": "kubectl", "module": "./custom-tools/kubectl.ts", "enabled": true },
    { "id": "terraform_plan", "module": "./custom-tools/terraform.ts", "enabled": false }
  ]
}
```

```ts
// tool-loader.ts
interface ToolSpec {
  id: string;
  module: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

async function loadToolsFromConfig(
  specs: ToolSpec[],
  config: MasterMindConfig,
): Promise<Record<string, MastraTool>> {
  const tools: Record<string, MastraTool> = {};

  for (const spec of specs) {
    if (spec.enabled === false) continue;
    const mod = await import(spec.module);
    const factory = mod.default ?? mod.createTool;

    if (typeof factory === 'function') {
      tools[spec.id] = factory(config, spec.options);
    } else {
      tools[spec.id] = factory;
    }
  }

  return tools;
}
```

**Pros**: Users can enable/disable tools without code changes. Supports custom user-authored tools from local paths. Mirrors the existing `PluginSpec` pattern.

**Cons**: Dynamic imports reduce type safety. Need schema validation for the config file. Error messages for broken tool modules need care.

---

## Pattern 5: Tool Composition (Meta-Tools)

**Concept**: Compose multiple low-level tools into higher-order tools that orchestrate multi-step workflows.

```ts
// composed-tools.ts
function createCostAnalysisTool(
  costSummary: MastraTool,
  costByService: MastraTool,
  resourceMetrics: MastraTool,
) {
  return createTool({
    id: 'cost_analysis',
    description: 'Run a full cost analysis: summary + service breakdown + resource utilization',
    inputSchema: z.object({
      provider: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }),
    execute: async (input) => {
      const [summary, services, metrics] = await Promise.all([
        costSummary.execute({ provider: input.provider, startDate: input.startDate, endDate: input.endDate }),
        costByService.execute({ provider: input.provider, startDate: input.startDate, endDate: input.endDate }),
        resourceMetrics.execute({ provider: input.provider, resourceType: 'compute', metricName: 'cpu_utilization' }),
      ]);

      return {
        content: JSON.stringify({ summary, services, metrics }, null, 2),
        isError: false,
      };
    },
  });
}
```

**Pros**: Reduces agent tool-call round-trips. Encapsulates common multi-tool workflows. LLM sees fewer tools (simpler decision space).

**Cons**: Less flexible than letting the LLM orchestrate tools itself. Input schemas become more complex. Failures in one sub-tool need careful handling.

---

## Pattern 6: Conditional / Context-Aware Injection

**Concept**: Inject different tool sets based on runtime context — detected environment, user permissions, available credentials, or conversation state.

```ts
// conditional-tools.ts
async function resolveToolSet(config: MasterMindConfig): Promise<Record<string, MastraTool>> {
  const tools: Record<string, MastraTool> = {};

  // Always available
  tools.bash = createBashTool(config.permissions);

  // Only if cost API is configured
  if (config.costApi.baseUrl && config.costApi.token) {
    tools.cost_query = createCostQueryTool(config.costApi);
    tools.cost_summary = createCostSummaryTool(config.costApi);
    tools.cost_by_service = createCostByServiceTool(config.costApi);
  }

  // Only if cloud CLIs are installed
  const awsInstalled = await which('aws');
  const gcloudInstalled = await which('gcloud');
  const azInstalled = await which('az');

  if (awsInstalled || gcloudInstalled || azInstalled) {
    tools.cloud_cli = cloudCliTool;
    tools.resource_list = resourceListTool;
    tools.resource_metrics = resourceMetricsTool;
  }

  // Only for admin users
  if (config.permissions?.allow?.includes('admin_tools')) {
    tools.dangerous_ops = createAdminTool();
  }

  return tools;
}
```

**Pros**: Agent only sees tools it can actually use — cleaner context, fewer error cases. Self-documenting: tool availability implies capability. Reduces false-positive tool calls.

**Cons**: Tool set varies per session, which can confuse users. Harder to test all permutations. Need to communicate unavailable tools clearly.

---

## Pattern 7: Tool Scoping / Namespacing

**Concept**: Group tools by domain (cost, cloud, system) and allow scoping via config or per-conversation settings.

```ts
// tool-groups.ts
const TOOL_GROUPS = {
  cost: ['cost_query', 'cost_summary', 'cost_by_service'],
  cloud: ['cloud_cli', 'resource_list', 'resource_metrics'],
  system: ['bash'],
} as const;

type ToolGroup = keyof typeof TOOL_GROUPS;

function resolveEnabledGroups(config: MasterMindConfig): ToolGroup[] {
  // From config: MASTER_MIND_TOOL_GROUPS=cost,cloud
  const groupsEnv = process.env.MASTER_MIND_TOOL_GROUPS;
  if (groupsEnv) {
    return groupsEnv.split(',').map(g => g.trim()) as ToolGroup[];
  }
  return ['cost', 'cloud', 'system']; // default: all
}

function filterToolsByGroups(
  allTools: Record<string, MastraTool>,
  groups: ToolGroup[],
): Record<string, MastraTool> {
  const enabledIds = new Set(groups.flatMap(g => TOOL_GROUPS[g]));
  return Object.fromEntries(
    Object.entries(allTools).filter(([id]) => enabledIds.has(id)),
  );
}
```

**Pros**: Lets operators restrict agent scope (e.g., "cost-only mode"). Supports multi-tenant deployments where different users need different capabilities. Clean way to disable entire feature areas.

**Cons**: The LLM system prompt needs to stay in sync with available tools. Grouping logic is another thing to maintain.

---

## Pattern 8: Hook-Based Tool Interception

**Concept**: Extend the plugin hook system to intercept tool calls before and after execution — without replacing the tools themselves.

```ts
// plugin.types.ts — extended hooks
export interface PluginHooks {
  onInit?(context: PluginContext): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
  beforeMessage?(message: string): string | Promise<string>;
  afterResponse?(response: { content: string; stopReason: string }): void | Promise<void>;

  // New tool hooks
  beforeToolCall?(call: ToolCallEvent): ToolCallEvent | null | Promise<ToolCallEvent | null>;
  afterToolResult?(result: ToolResultEvent): ToolResultEvent | Promise<ToolResultEvent>;
}

interface ToolCallEvent {
  toolName: string;
  args: Record<string, unknown>;
}

interface ToolResultEvent {
  toolName: string;
  result: { content: string; isError: boolean };
  durationMs: number;
}
```

**Integration in `agent.ts`**:

```ts
case 'tool-call':
  // Run plugin interception
  let callEvent = { toolName: chunk.payload.toolName, args: chunk.payload.args };
  if (this.hookManager) {
    const intercepted = await this.hookManager.runBeforeToolCall(callEvent);
    if (intercepted === null) {
      // Plugin vetoed this tool call
      break;
    }
    callEvent = intercepted;
  }
  // ... proceed with tool call
```

**Pros**: Plugins can audit, modify, or block tool calls without needing to replace tools. Supports use cases like cost tracking per tool call, PII redaction from tool inputs, or dry-run mode. Orthogonal to tool registration.

**Cons**: Intercepting at the Mastra agent level may require patching the stream. Plugin ordering matters (who vetoes first?). Performance overhead per tool call.

---

## Pattern 9: Dependency-Injected Tool Factories

**Concept**: Tools declare their dependencies (services, configs, other tools) and a DI container resolves them at build time.

```ts
// tool-di.ts
interface ToolDependencies {
  config?: MasterMindConfig;
  costApi?: CostApiOptions;
  permissions?: PermissionsConfig;
  registry?: CostProviderRegistry;
  otherTools?: Record<string, MastraTool>;
}

type ToolFactory = (deps: ToolDependencies) => MastraTool;

const toolFactories = new Map<string, ToolFactory>();

// Registration
toolFactories.set('bash', (deps) => createBashTool(deps.permissions));
toolFactories.set('cost_query', (deps) => createCostQueryTool(deps.costApi!));
toolFactories.set('cost_analysis', (deps) => {
  // Depends on other tools
  const summary = deps.otherTools!['cost_summary']!;
  const byService = deps.otherTools!['cost_by_service']!;
  return createCostAnalysisTool(summary, byService);
});

// Resolution
function buildTools(
  factories: Map<string, ToolFactory>,
  deps: ToolDependencies,
): Record<string, MastraTool> {
  const tools: Record<string, MastraTool> = {};

  // First pass: tools without tool dependencies
  for (const [id, factory] of factories) {
    tools[id] = factory({ ...deps, otherTools: {} });
  }

  // Second pass: tools with tool dependencies (resolve references)
  for (const [id, factory] of factories) {
    tools[id] = factory({ ...deps, otherTools: tools });
  }

  return tools;
}
```

**Pros**: Explicit dependency declaration. Testable — inject mocks for any dependency. Enables topological ordering of tool construction.

**Cons**: Two-pass resolution is fragile for deep dependency chains. Over-engineering for the current tool count (7 tools). DI containers tend to grow in complexity.

---

## Pattern 10: Runtime Tool Hot-Swap

**Concept**: Allow tools to be added, removed, or replaced during a running session via slash commands or plugin signals.

```ts
// agent.ts — extended
class Agent {
  private currentTools: Record<string, MastraTool>;

  addTool(id: string, tool: MastraTool): void {
    this.currentTools[id] = tool;
    this.rebuildMastraAgent();
  }

  removeTool(id: string): void {
    delete this.currentTools[id];
    this.rebuildMastraAgent();
  }

  private rebuildMastraAgent(): void {
    const toolNames = Object.keys(this.currentTools);
    const systemPrompt = buildSystemPrompt(this.config, toolNames);
    this.mastraAgent = new MastraAgent({
      id: 'master_mind',
      name: 'Master Mind',
      instructions: systemPrompt,
      model: this.modelString,
      tools: this.currentTools,
    });
  }
}
```

**Slash command integration**:

```ts
// commands.ts
{
  name: '/tool',
  description: 'Manage tools: /tool add <path> | /tool remove <id> | /tool list',
  handler: async (args, agent) => {
    const [action, target] = args.split(' ');
    switch (action) {
      case 'list':
        return Object.keys(agent.currentTools).join(', ');
      case 'add':
        const mod = await import(target);
        agent.addTool(mod.default.id, mod.default);
        return `Tool "${mod.default.id}" added`;
      case 'remove':
        agent.removeTool(target);
        return `Tool "${target}" removed`;
    }
  },
}
```

**Pros**: Maximum flexibility during interactive sessions. Power-user friendly. Supports experimentation without restarts.

**Cons**: Rebuilding the Mastra agent mid-conversation may lose context. Security risk — loading arbitrary modules at runtime. System prompt drift if tools change mid-conversation.

---

## Recommended Combinations

For a practical evolution of the current architecture, these patterns compose well together:

| Phase | Patterns | Rationale |
|-------|----------|-----------|
| **Near-term** | #1 (Plugin-Provided Tools) + #3 (Middleware) | Lowest friction. Plugins already exist; just extend them to carry tools. Middleware adds observability without changing tool code. |
| **Mid-term** | #2 (Tool Registry) + #6 (Conditional Injection) + #7 (Scoping) | Registry becomes the backbone. Conditional logic prunes unavailable tools. Scoping enables multi-tenant or restricted modes. |
| **Long-term** | #8 (Hook Interception) + #4 (Config-Driven Loading) | Full extensibility. External users can author tools as standalone modules, loaded from config. Hook interception provides audit/compliance layer. |

### Anti-patterns to avoid

- **God registry** — a single registry that handles tools, plugins, providers, and config. Keep registries domain-specific.
- **Deep DI chains** — tools depending on tools depending on services. Keep the dependency graph shallow (max 2 levels).
- **Implicit tool mutation** — tools that modify shared state without the agent knowing. Tools should be pure functions of their inputs + external APIs.
- **Over-scoping** — giving every tool access to the full `MasterMindConfig`. Use narrow interfaces (`CostApiOptions`, `PermissionsConfig`) so tools only see what they need.

---

## Implementation Priority

1. **Plugin-Provided Tools** (#1) — smallest diff, highest value. Unlocks the entire plugin ecosystem for tool contribution.
2. **Tool Middleware** (#3) — logging and caching are immediately useful. Can be added independently of any registry work.
3. **Conditional Injection** (#6) — eliminates runtime errors from missing credentials/CLIs. Improves user experience with no new APIs.
4. **Hook-Based Interception** (#8) — natural extension of the existing hook system. Enables audit logging and dry-run mode.
5. **Tool Registry** (#2) — needed once the tool count grows beyond ~15 or when external tool packages emerge.
