/**
 * Generic MCP Tools for AI SDK
 *
 * Dynamically fetches available tools from any MCP server and creates
 * AI SDK tool wrappers for each one automatically.
 *
 * This is a generic implementation that works with any MCP server.
 * The MCP server URL, name, and tool filtering should be passed from the route handlers.
 */

import { tool } from "ai";
import { z } from "zod";
import { trackToolUsage } from "../metrics";
import {
  hasAnyAtlassianMcpCredential,
  mergeAtlassianMcpRows,
} from "./atlassian-session-merge";
import {
  initializeMcpSession,
  makeMcpRequest,
  sendInitializedNotification,
} from "./client";
import type { McpCredentials } from "./types";

/**
 * MCP Tool definition from the server.
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Get the effective token for MCP server communication based on the tool type.
 * Jira tools need the Jira token, Confluence tools need the Confluence token.
 */
function getEffectiveToken(
  credentials: McpCredentials,
  toolName?: string
): string {
  if (toolName) {
    const name = toolName.toLowerCase();
    if (name.startsWith("jira_")) {
      return credentials.jiraToken ?? credentials.accessToken ?? "";
    }
    if (name.startsWith("confluence_")) {
      return credentials.confluenceToken ?? credentials.accessToken ?? "";
    }
  }
  // Default: use Jira token as primary, then Confluence, then generic access token
  return (
    credentials.jiraToken ??
    credentials.confluenceToken ??
    credentials.accessToken ??
    ""
  );
}

/**
 * Get the user's MCP access token and server URL from the database.
 * This is a generic helper - for server-specific credentials, use server-specific functions.
 * Checks for both "atlassian" and "confluence" server names for backward compatibility.
 */
async function getMcpCredentials(userId: string): Promise<McpCredentials> {
  console.log("[MCP] Fetching credentials for userId:", userId);
  const { getAllMcpSessionsByUserId } = await import("@/lib/db/queries");
  const sessions = await getAllMcpSessionsByUserId({ userId });

  console.log(
    "[MCP] Found sessions:",
    sessions.map((s) => ({
      serverName: s.serverName,
      sessionId: s.sessionId,
      serverUrl: s.serverUrl,
      hasJiraToken: !!s.jiraToken,
      hasConfluenceToken: !!s.confluenceToken,
    }))
  );

  const atlassianSessions = sessions.filter(
    (s) =>
      s.serverName === "atlassian" ||
      s.serverName === "jira" ||
      s.serverName === "confluence"
  );

  if (!atlassianSessions.length) {
    console.log("[MCP] No Atlassian session found for userId:", userId);
    throw new Error(
      "Atlassian MCP is not connected. Please connect in Settings > Apps."
    );
  }

  const merged = mergeAtlassianMcpRows(atlassianSessions, userId);

  console.log("[MCP] Merged Atlassian credentials:", {
    serverUrl: merged.serverUrl,
    sessionId: merged.sessionId,
    hasJiraToken: !!merged.jiraToken,
    hasConfluenceToken: !!merged.confluenceToken,
  });

  return merged;
}

/**
 * List available tools from the MCP server.
 */
export async function listMcpTools(
  credentials: McpCredentials
): Promise<{ tools: unknown[] }> {
  console.log("[MCP] listMcpTools called with:", {
    serverUrl: credentials.serverUrl,
    sessionId: credentials.sessionId,
  });

  const request = {
    jsonrpc: "2.0" as const,
    id: Date.now(),
    method: "tools/list",
    params: {},
  };

  console.log("[MCP] Sending tools/list request:", JSON.stringify(request));

  const response = await makeMcpRequest(
    {
      baseUrl: credentials.serverUrl,
      accessToken: credentials.effectiveToken ?? credentials.accessToken,
      userId: credentials.userId,
    },
    credentials.sessionId,
    request
  );

  console.log(
    "[MCP] tools/list response status:",
    response.status,
    response.ok
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[MCP] tools/list error:", errorText);
    throw new Error(`Failed to list tools: ${response.status} ${errorText}`);
  }

  const rawText = await response.clone().text();
  console.log("[MCP] tools/list raw response:", rawText.slice(0, 2000));

  const data = await parseSseResponse(response);

  console.log(
    "[MCP] tools/list parsed data:",
    JSON.stringify(data, null, 2).slice(0, 1000)
  );

  if (data.error) {
    throw new Error(`Error listing tools: ${data.error.message}`);
  }

  return data.result as { tools: unknown[] };
}

/**
 * Execute an MCP tool call.
 * Handles session recovery by re-initializing if the session is invalid.
 */
async function executeMcpTool<T>(
  credentials: McpCredentials,
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<T> {
  const request = {
    jsonrpc: "2.0" as const,
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: toolArgs,
    },
  };

  // Get the effective token for this specific tool
  const effectiveToken = getEffectiveToken(credentials, toolName);

  // Try with existing session ID first
  let response = await makeMcpRequest(
    {
      baseUrl: credentials.serverUrl,
      accessToken: effectiveToken,
      userId: credentials.userId,
    },
    credentials.sessionId,
    request
  );

  // If session is invalid, re-initialize and try again
  if (!response.ok && (response.status === 401 || response.status === 403)) {
    console.log(
      `[MCP] Session ${credentials.sessionId} invalid, re-initializing...`
    );

    const newSessionId = await initializeMcpSession({
      baseUrl: credentials.serverUrl,
      accessToken: effectiveToken,
      userId: credentials.userId,
    });

    await sendInitializedNotification(
      {
        baseUrl: credentials.serverUrl,
        accessToken: effectiveToken,
        userId: credentials.userId,
      },
      newSessionId
    );

    console.log(`[MCP] Re-initialized session: ${newSessionId}`);

    // Update the session in database
    const { updateMcpSessionLastUsed } = await import("@/lib/db/queries");
    await updateMcpSessionLastUsed({ sessionId: newSessionId }).catch(() => {
      // Ignore DB update errors
    });

    // Retry with new session
    response = await makeMcpRequest(
      {
        baseUrl: credentials.serverUrl,
        accessToken: effectiveToken,
        userId: credentials.userId,
      },
      newSessionId,
      request
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP tool call failed: ${response.status} ${errorText}`);
  }

  // Parse the response - MCP server returns SSE streams
  const data = await parseSseResponse(response);

  // Check for JSON-RPC error
  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message}`);
  }

  // Check for MCP tool error (isError flag in result)
  const toolResult = data.result as {
    isError?: boolean;
    content?: Array<{ text?: string }>;
  };
  if (toolResult?.isError) {
    const errorMessage =
      toolResult.content?.[0]?.text || "Unknown MCP tool error";
    throw new Error(`MCP tool error: ${errorMessage}`);
  }

  return data.result as T;
}

/**
 * Parse an SSE (Server-Sent Events) response from an MCP server.
 * MCP servers return SSE streams with event: and data: prefixed lines.
 */
async function parseSseResponse(response: Response): Promise<{
  result?: unknown;
  error?: { message: string };
  [key: string]: unknown;
}> {
  const text = await response.text();

  // Try plain JSON first (some servers return plain JSON)
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    // Not plain JSON, try SSE format
  }

  // Parse SSE format - look for data: lines
  const lines = text.split("\n");
  let lastJsonData: {
    result?: unknown;
    error?: { message: string };
    [key: string]: unknown;
  } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and event: lines
    if (!trimmedLine || trimmedLine.startsWith("event:")) {
      continue;
    }

    // Look for data: lines
    if (trimmedLine.startsWith("data:")) {
      const jsonData = trimmedLine.slice(5).trim();
      try {
        lastJsonData = JSON.parse(jsonData);
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  if (lastJsonData) {
    return lastJsonData;
  }

  throw new Error(
    `Failed to parse MCP response as JSON or SSE: ${text.slice(0, 200)}`
  );
}

/**
 * Convert MCP input schema to Zod schema.
 * Handles common JSON Schema types and converts them to Zod equivalents.
 */
function mcpSchemaToZod(inputSchema: McpTool["inputSchema"]): z.ZodType {
  if (!inputSchema || inputSchema.type !== "object") {
    return z.object({});
  }

  const properties = inputSchema.properties || {};
  const required = inputSchema.required || [];

  const schemaShape: Record<string, z.ZodType> = {};

  for (const [key, value] of Object.entries(properties)) {
    const prop = value as { type?: string; description?: string };
    let zodType: z.ZodType;

    switch (prop.type) {
      case "string":
        zodType = z.string();
        break;
      case "number":
      case "integer":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.unknown());
        break;
      case "object":
        zodType = z.record(z.unknown());
        break;
      default:
        zodType = z.unknown();
    }

    // Add description if available
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    // Make optional if not in required array
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    schemaShape[key] = zodType;
  }

  return z.object(schemaShape);
}

/**
 * Create a dynamic AI SDK tool from an MCP tool definition.
 */
function createDynamicMcpTool(
  userId: string,
  mcpTool: McpTool,
  options?: {
    toolNamePrefix?: string;
    descriptionPrefix?: string;
    filterTool?: (tool: McpTool) => boolean;
    chatId?: string;
    messageId?: string;
  }
) {
  const name = mcpTool.name;
  const descriptionPrefix =
    options?.descriptionPrefix || `Call the ${name} tool on the MCP server.`;
  const description = mcpTool.description || descriptionPrefix;
  const inputSchema = mcpSchemaToZod(mcpTool.inputSchema);

  return tool({
    description,
    inputSchema,
    execute: async (input: Record<string, unknown>) => {
      const startTime = performance.now();
      try {
        const credentials = await getMcpCredentials(userId);

        // executeMcpTool will determine the correct token based on tool name
        const result = await executeMcpTool(credentials, name, input);
        const durationMs = Math.round(performance.now() - startTime);

        await trackToolUsage({
          userId,
          toolName: name,
          toolType: "mcp",
          chatId: options?.chatId,
          messageId: options?.messageId,
          success: true,
          durationMs,
        });

        return result;
      } catch (error) {
        const durationMs = Math.round(performance.now() - startTime);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to execute MCP tool";

        await trackToolUsage({
          userId,
          toolName: name,
          toolType: "mcp",
          chatId: options?.chatId,
          messageId: options?.messageId,
          success: false,
          errorMessage,
          durationMs,
        });

        return {
          error: errorMessage,
        };
      }
    },
  });
}

/**
 * Configuration for creating MCP tools.
 */
export interface CreateMcpToolsConfig {
  /** User ID for fetching credentials */
  userId: string;
  /** Optional prefix to add to tool names (e.g., "atlassian_") */
  toolNamePrefix?: string;
  /** Optional filter function to include only specific tools */
  filterTool?: (tool: McpTool) => boolean;
  /** Optional description prefix for tools */
  descriptionPrefix?: string;
  /** Optional custom credentials (if not fetching from DB) */
  customCredentials?: McpCredentials;
  /** Optional token-based filtering - if provided, only tools for services with tokens are included */
  availableTokens?: {
    hasJiraToken: boolean;
    hasConfluenceToken: boolean;
  };
  /** Optional chat ID for metrics tracking */
  chatId?: string;
  /** Optional message ID for metrics tracking */
  messageId?: string;
}

/**
 * Fetch tools from the MCP server and create AI SDK tool wrappers dynamically.
 * Returns a record of tools that can be spread into the AI SDK streamText call.
 */
export async function createMcpTools(
  config: CreateMcpToolsConfig
): Promise<Record<string, unknown>> {
  const {
    userId,
    toolNamePrefix,
    filterTool,
    descriptionPrefix,
    customCredentials,
    availableTokens,
    chatId,
    messageId,
  } = config;

  console.log("[MCP] createMcpTools called with config:", {
    userId,
    toolNamePrefix,
    hasFilter: !!filterTool,
    hasCustomCredentials: !!customCredentials,
    availableTokens,
  });

  try {
    const credentials = customCredentials ?? (await getMcpCredentials(userId));

    console.log(
      "[MCP] Got credentials, fetching tools from MCP server:",
      credentials.serverUrl
    );

    const toolsResult = await listMcpTools(credentials);

    console.log(
      "[MCP] Raw tools response:",
      JSON.stringify(toolsResult, null, 2).slice(0, 1000)
    );

    let toolsList = toolsResult.tools || toolsResult;

    if (!Array.isArray(toolsList)) {
      console.warn("[MCP] No tools array in response:", toolsResult);
      return {};
    }

    console.log(
      "[MCP] Found",
      toolsList.length,
      "total tools before filtering"
    );
    console.log(
      "[MCP] Tool names:",
      toolsList.map((t: McpTool) => t.name)
    );

    // Build token-aware filter
    const tokens = availableTokens ?? {
      hasJiraToken: !!credentials.jiraToken,
      hasConfluenceToken: !!credentials.confluenceToken,
    };

    // If no tokens are provided, don't filter by token availability
    const tokenAwareFilter = (tool: McpTool) => {
      const name = tool.name?.toLowerCase();

      // If both tokens are available, allow all Atlassian tools
      if (tokens.hasJiraToken && tokens.hasConfluenceToken) {
        return (
          name?.startsWith("confluence_") ||
          name?.startsWith("jira_") ||
          name?.startsWith("atlassian_")
        );
      }

      // If only Jira token is available, only allow Jira tools
      if (tokens.hasJiraToken && !tokens.hasConfluenceToken) {
        return name?.startsWith("jira_") || name?.startsWith("atlassian_");
      }

      // If only Confluence token is available, only allow Confluence tools
      if (!tokens.hasJiraToken && tokens.hasConfluenceToken) {
        return (
          name?.startsWith("confluence_") || name?.startsWith("atlassian_")
        );
      }

      // If no tokens, don't include any Atlassian tools
      return false;
    };

    // Combine with user-provided filter
    const combinedFilter = filterTool
      ? (tool: McpTool) => filterTool(tool) && tokenAwareFilter(tool)
      : tokenAwareFilter;

    // Filter tools
    const beforeFilter = toolsList.length;
    toolsList = toolsList.filter(combinedFilter);
    console.log(
      "[MCP] After token-aware filtering:",
      toolsList.length,
      "tools (was",
      beforeFilter,
      ")"
    );
    console.log(
      "[MCP] Filtered tool names:",
      toolsList.map((t: McpTool) => t.name)
    );

    console.log(`[MCP] Creating ${toolsList.length} tools dynamically`);

    // Create AI SDK tools for each MCP tool
    const tools: Record<string, unknown> = {};

    for (const mcpToolItem of toolsList) {
      const mcpTool = mcpToolItem as McpTool;
      // Convert tool name to valid identifier (replace dots, dashes with underscores)
      let toolName = mcpTool.name.replace(/[^a-zA-Z0-9_]/g, "_");

      // Add prefix if specified
      if (toolNamePrefix) {
        toolName = `${toolNamePrefix}_${toolName}`;
      }

      console.log("[MCP] Creating tool:", mcpTool.name, "->", toolName);

      tools[toolName] = createDynamicMcpTool(userId, mcpTool, {
        toolNamePrefix,
        descriptionPrefix,
        chatId,
        messageId,
      });
    }

    console.log("[MCP] Created tools:", Object.keys(tools));

    return tools;
  } catch (error) {
    console.error("[MCP] Failed to create dynamic tools:", error);
    return {};
  }
}

/**
 * Get the list of available MCP tools for display purposes.
 */
export async function getMcpToolList(
  credentials: McpCredentials,
  options?: {
    filterTool?: (tool: McpTool) => boolean;
  }
): Promise<string[]> {
  try {
    const toolsResult = await listMcpTools(credentials);

    let toolsList = toolsResult.tools || toolsResult;

    if (!Array.isArray(toolsList)) {
      return [];
    }

    if (options?.filterTool) {
      toolsList = toolsList.filter(options.filterTool);
    }

    return toolsList.map((t: McpTool) => t.name);
  } catch {
    return [];
  }
}

/**
 * Check if a user has Atlassian MCP connected.
 * Returns true if the user has an active Atlassian MCP session.
 * Checks for both "atlassian" and "confluence" server names for backward compatibility.
 */
export async function hasAtlassianMcpConnected(
  userId: string
): Promise<boolean> {
  try {
    console.log("[MCP] hasAtlassianMcpConnected called for userId:", userId);
    const { getAllMcpSessionsByUserId } = await import("@/lib/db/queries");
    const sessions = await getAllMcpSessionsByUserId({ userId });
    console.log(
      "[MCP] Sessions found:",
      sessions.map((s) => ({
        serverName: s.serverName,
        sessionId: s.sessionId,
      }))
    );
    const hasConnection = hasAnyAtlassianMcpCredential(sessions);
    console.log("[MCP] hasAtlassianMcpConnected result:", hasConnection);
    return hasConnection;
  } catch (error) {
    console.log("[MCP] hasAtlassianMcpConnected error:", error);
    return false;
  }
}
