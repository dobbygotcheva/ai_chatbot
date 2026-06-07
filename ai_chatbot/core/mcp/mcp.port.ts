// MCP Port - Core defines what MCP capabilities it needs

export type McpAppId =
  | "microsoft-outlook"
  | "microsoft-teams"
  | "jira"
  | "confluence"
  | "libreoffice";

export interface McpToolParameter {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, McpToolParameter>;
}

export interface McpAppDefinition {
  id: McpAppId;
  name: string;
  description: string;
  category: "productivity" | "communication" | "collaboration" | "office";
  tools: McpToolDefinition[];
}

export interface McpToolExecutionInput {
  appId: McpAppId;
  toolName: string;
  parameters: Record<string, unknown>;
  userId: string;
}

export interface McpToolExecutionOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface McpConnectionConfig {
  appId: McpAppId;
  userId: string;
  credentials: Record<string, string>;
}

/**
 * MCP Port - Core interface for MCP capabilities
 */
export interface McpPort {
  getAppDefinitions(): McpAppDefinition[];
  executeTool(input: McpToolExecutionInput): Promise<McpToolExecutionOutput>;
  connect(config: McpConnectionConfig): Promise<void>;
  disconnect(appId: McpAppId, userId: string): Promise<void>;
  isConnected(appId: McpAppId, userId: string): Promise<boolean>;
}

/**
 * Individual Connector Port
 */
export interface McpConnectorPort {
  readonly appId: McpAppId;
  readonly appDefinition: McpAppDefinition;
  executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    userId: string
  ): Promise<McpToolExecutionOutput>;
  connect(userId: string, credentials: Record<string, string>): Promise<void>;
  disconnect(userId: string): Promise<void>;
  isConnected(userId: string): Promise<boolean>;
}
