import { auth } from "@/app/(auth)/auth";
import {
  getMcpSessionByUserId,
  updateMcpSessionLastUsed,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { makeMcpRequest } from "@/lib/mcp/client";
import type { McpToolCallResult } from "@/lib/mcp/types";

/**
 * MCP Tool Execution Route
 *
 * This route handles executing tools on connected MCP servers.
 * It retrieves the user's MCP session and makes a tool call request.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ appId: string; tool: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { appId, tool } = await params;

  // Get the MCP session for this user and server
  const mcpSession = await getMcpSessionByUserId({
    userId: session.user.id,
    serverName: appId,
  });

  if (!mcpSession) {
    return Response.json(
      { error: `MCP server "${appId}" is not connected` },
      { status: 400 }
    );
  }

  let toolParams: Record<string, unknown> = {};
  try {
    const body = await request.json();
    toolParams = body.params ?? {};
  } catch {
    // empty params is fine
  }

  // Build the MCP tool call request
  const mcpRequest = {
    jsonrpc: "2.0" as const,
    id: Date.now(),
    method: "tools/call",
    params: {
      name: tool,
      arguments: toolParams,
    },
  };

  // Build session config from database session
  const sessionConfig = {
    baseUrl: mcpSession.serverUrl,
    accessToken:
      mcpSession.accessToken ||
      mcpSession.jiraToken ||
      mcpSession.confluenceToken ||
      "",
    userId: session.user.id,
  };

  try {
    const response = await makeMcpRequest(
      sessionConfig,
      mcpSession.sessionId,
      mcpRequest
    );

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        {
          success: false,
          error: `MCP tool call failed: ${response.status} ${errorText}`,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Update last used time on successful call
    await updateMcpSessionLastUsed({ sessionId: mcpSession.sessionId });

    const toolResult: McpToolCallResult = {
      success: !result.error,
      data: result.result,
      error: result.error?.message,
    };

    return Response.json(toolResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
