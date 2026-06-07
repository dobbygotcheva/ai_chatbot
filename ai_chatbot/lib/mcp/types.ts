/**
 * MCP Types - Generic MCP Client Types
 */

export interface McpInitializeRequest {
  jsonrpc: "2.0";
  id: number;
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface McpInitializeResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    serverInfo: {
      name: string;
      version: string;
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface McpNotificationRequest {
  jsonrpc: "2.0";
  method: "notifications/initialized";
}

export interface McpSessionConfig {
  baseUrl: string;
  accessToken: string;
  userId: string;
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Connector types for MCP integrations
export interface ConnectorContext {
  userId: string;
  config?: Record<string, string>;
  accessToken?: string;
  refreshToken?: string;
}

export interface Connector {
  appId: string;
  refreshToken?: (ctx: ConnectorContext) => Promise<Partial<ConnectorContext>>;
  tools: Record<
    string,
    (
      params: Record<string, unknown>,
      context: ConnectorContext
    ) => Promise<ToolCallResult>
  >;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AppToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AppToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, AppToolParameter>;
}

export interface AppConfigField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authMethod: string;
  oauthProvider?: string;
  requiredScopes?: string[];
  tools: AppToolDefinition[];
  configFields?: AppConfigField[];
}

/** Credentials for an MCP server session (Atlassian / multi-token). */
export interface McpCredentials {
  serverUrl: string;
  sessionId: string;
  accessToken: string;
  userId: string;
  jiraToken?: string | null;
  confluenceToken?: string | null;
  /** Computed effective token for MCP server communication */
  effectiveToken?: string;
}
