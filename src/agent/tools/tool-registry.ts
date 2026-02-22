import type { Tool } from '@mastra/core/tools';

export interface ToolMeta {
  group: string;
  source: string;
  requires?: string[];
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private metadata = new Map<string, ToolMeta>();

  register(id: string, tool: Tool, meta: ToolMeta): void {
    if (this.tools.has(id)) {
      throw new Error(
        `Tool "${id}" is already registered (source: ${this.metadata.get(id)?.source})`,
      );
    }
    this.tools.set(id, tool);
    this.metadata.set(id, meta);
  }

  override(id: string, tool: Tool, meta?: Partial<ToolMeta>): void {
    if (!this.tools.has(id)) {
      throw new Error(`Cannot override "${id}": not registered`);
    }
    this.tools.set(id, tool);
    if (meta) {
      const existing = this.metadata.get(id)!;
      this.metadata.set(id, { ...existing, ...meta });
    }
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getMeta(id: string): ToolMeta | undefined {
    return this.metadata.get(id);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  all(): Record<string, Tool> {
    return Object.fromEntries(this.tools);
  }

  list(): string[] {
    return [...this.tools.keys()];
  }

  byGroup(group: string): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [id, meta] of this.metadata) {
      if (meta.group === group) {
        result[id] = this.tools.get(id)!;
      }
    }
    return result;
  }

  groups(): string[] {
    const groups = new Set<string>();
    for (const meta of this.metadata.values()) {
      groups.add(meta.group);
    }
    return [...groups];
  }

  remove(id: string): boolean {
    this.metadata.delete(id);
    return this.tools.delete(id);
  }
}
