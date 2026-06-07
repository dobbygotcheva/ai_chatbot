// Tool Registry - Infrastructure implementation
// Manages tool registration and lookup

import type {
  ToolDefinition,
  ToolPort,
  ToolRegistryPort,
} from "../../core/ai/tool.port";

export class ToolRegistry implements ToolRegistryPort {
  readonly tools: Map<string, ToolPort> = new Map();

  register(tool: ToolPort): void {
    this.tools.set(tool.definition.name, tool);
  }

  unregister(toolName: string): void {
    this.tools.delete(toolName);
  }

  getTool(name: string): ToolPort | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolPort[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((t) => t.definition);
  }
}
