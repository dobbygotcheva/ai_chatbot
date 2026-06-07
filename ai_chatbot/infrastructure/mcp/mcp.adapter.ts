// MCP Adapter - Implements McpPort using individual connectors

import type {
  McpAppDefinition,
  McpConnectionConfig,
  McpConnectorPort,
  McpPort,
  McpToolExecutionInput,
  McpToolExecutionOutput,
} from "../../core/mcp/mcp.port";

export class McpAdapter implements McpPort {
  readonly connectors: Map<string, McpConnectorPort>;

  constructor(connectors: McpConnectorPort[]) {
    this.connectors = new Map(connectors.map((c) => [c.appId, c]));
  }

  getAppDefinitions(): McpAppDefinition[] {
    return Array.from(this.connectors.values()).map((c) => c.appDefinition);
  }

  executeTool(input: McpToolExecutionInput): Promise<McpToolExecutionOutput> {
    const connector = this.connectors.get(input.appId);
    if (!connector) {
      return Promise.resolve({
        success: false,
        error: `No connector found for app: ${input.appId}`,
      });
    }

    return connector.executeTool(
      input.toolName,
      input.parameters,
      input.userId
    );
  }

  async connect(config: McpConnectionConfig): Promise<void> {
    const connector = this.connectors.get(config.appId);
    if (!connector) {
      throw new Error(`No connector found for app: ${config.appId}`);
    }

    await connector.connect(config.userId, config.credentials);
  }

  async disconnect(appId: string, userId: string): Promise<void> {
    const connector = this.connectors.get(appId);
    if (!connector) {
      throw new Error(`No connector found for app: ${appId}`);
    }

    await connector.disconnect(userId);
  }

  isConnected(appId: string, userId: string): Promise<boolean> {
    const connector = this.connectors.get(appId);
    if (!connector) {
      return Promise.resolve(false);
    }

    return connector.isConnected(userId);
  }
}
