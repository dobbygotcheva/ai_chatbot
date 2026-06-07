// Atlassian Connector Adapter - Wraps existing Atlassian connector

import type {
  McpAppDefinition,
  McpAppId,
  McpConnectorPort,
  McpToolExecutionOutput,
} from "../../../core/mcp/mcp.port";

import type { Connector, ConnectorContext } from "../../../lib/mcp/types";

export class AtlassianConnectorAdapter implements McpConnectorPort {
  readonly appId: McpAppId = "jira";

  readonly appDefinition: McpAppDefinition = {
    id: "jira",
    name: "Jira",
    description: "Create, update, and search Jira issues",
    category: "collaboration",
    tools: [
      {
        name: "searchIssues",
        description: "Search for Jira issues using JQL",
        parameters: {
          jql: {
            type: "string",
            description: "JQL query string",
            required: true,
          },
        },
      },
      {
        name: "createIssue",
        description: "Create a new Jira issue",
        parameters: {
          project: {
            type: "string",
            description: "Project key",
            required: true,
          },
          summary: {
            type: "string",
            description: "Issue summary",
            required: true,
          },
          description: {
            type: "string",
            description: "Issue description",
            required: false,
          },
          issueType: {
            type: "string",
            description: "Issue type (e.g., Task, Bug)",
            required: true,
          },
        },
      },
    ],
  };

  readonly connections: Map<string, ConnectorContext> = new Map();
  private connector: Connector | null = null;

  constructor() {
    this.loadConnector();
  }

  private async loadConnector(): Promise<void> {
    if (this.connector) {
      return;
    }

    const { jiraConnector } = await import(
      "../../../lib/mcp/connectors/atlassian"
    );
    this.connector = jiraConnector;
  }

  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    userId: string
  ): Promise<McpToolExecutionOutput> {
    await this.loadConnector();

    if (!this.connector) {
      return {
        success: false,
        error: "Atlassian connector not available",
      };
    }

    const context = this.connections.get(userId);
    if (!context) {
      return {
        success: false,
        error: "Not connected to Atlassian",
      };
    }

    // Map camelCase tool names to snake_case
    const toolMap: Record<string, string> = {
      searchIssues: "search_issues",
      createIssue: "create_issue",
      getIssue: "get_issue",
      updateIssue: "update_issue",
      listProjects: "list_projects",
    };

    const toolHandler = this.connector.tools[toolMap[toolName] ?? toolName];

    if (!toolHandler) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    try {
      const result = await toolHandler(parameters, context);

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  connect(userId: string, credentials: Record<string, string>): Promise<void> {
    const context: ConnectorContext = {
      userId,
      config: {
        baseUrl: credentials.baseUrl,
        email: credentials.email,
        apiToken: credentials.apiToken,
      },
    };

    this.connections.set(userId, context);
    return Promise.resolve();
  }

  disconnect(userId: string): Promise<void> {
    this.connections.delete(userId);
    return Promise.resolve();
  }

  isConnected(userId: string): Promise<boolean> {
    return Promise.resolve(this.connections.has(userId));
  }
}
