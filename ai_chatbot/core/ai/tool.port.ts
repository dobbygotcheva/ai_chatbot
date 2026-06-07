// Tool Port - Core defines tool interface
// Tools are injected via registry for composition

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolExecutionContext {
  userId: string;
  chatId: string;
  requestContext: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Tool Port - Individual tool interface
 */
export interface ToolPort {
  readonly definition: ToolDefinition;
  execute(
    parameters: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
}

/**
 * Tool Registry Port - Manages available tools
 */
export interface ToolRegistryPort {
  register(tool: ToolPort): void;
  unregister(toolName: string): void;
  getTool(name: string): ToolPort | undefined;
  getAllTools(): ToolPort[];
  getToolDefinitions(): ToolDefinition[];
}
