import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createMcpSession, getAllMcpSessionsByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import {
  initializeMcpSession,
  type McpSessionConfig,
  sendInitializedNotification,
} from "@/lib/mcp/client";
import { config } from "@/shared/config";

export interface McpAtlassianInitRequest {
  jiraToken?: string;
  confluenceToken?: string;
  accessToken?: string; // For backward compatibility
  baseUrl?: string;
}

export interface McpAtlassianInitResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

/**
 * POST /api/mcp/atlassian
 *
 * Initialize a connection with the Atlassian MCP server.
 *
 * Request body:
 * - jiraToken: Optional Jira personal access token
 * - confluenceToken: Optional Confluence personal access token
 * - accessToken: Optional generic access token (for backward compatibility)
 * - baseUrl: Optional custom MCP server URL (defaults to process.env.ATLASSIAN_MCP)
 *
 * At least one token (jiraToken or confluenceToken) is required.
 *
 * Response:
 * - success: Whether the initialization was successful
 * - sessionId: The session ID for subsequent requests (stored server-side)
 * - error: Error message if initialization failed
 */
export async function POST(
  request: Request
): Promise<NextResponse<McpAtlassianInitResponse>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError(
        "unauthorized:chat"
      ).toResponse() as NextResponse<McpAtlassianInitResponse>;
    }

    let body: McpAtlassianInitRequest;
    try {
      body = await request.json();
    } catch {
      return new ChatSDKError(
        "bad_request:api"
      ).toResponse() as NextResponse<McpAtlassianInitResponse>;
    }

    const { jiraToken, confluenceToken, accessToken, baseUrl } = body;

    const mcpBaseUrl = baseUrl ?? config.mcp.atlassian;

    if (!mcpBaseUrl) {
      return new ChatSDKError(
        "bad_request:api",
        "Atlassian MCP URL is not configured. Please set ATLASSIAN_MCP environment variable or provide baseUrl."
      ).toResponse() as NextResponse<McpAtlassianInitResponse>;
    }

    // If no tokens provided, try to use saved tokens from database (reconnection after restart)
    let effectiveToken = accessToken || jiraToken || confluenceToken;

    if (!effectiveToken) {
      // Fetch saved tokens from database
      const sessions = await getAllMcpSessionsByUserId({
        userId: session.user.id,
      });
      const savedSession = sessions.find(
        (s) =>
          s.serverName === "atlassian" ||
          s.serverName === "jira" ||
          s.serverName === "confluence"
      );

      if (!savedSession) {
        return new ChatSDKError(
          "bad_request:api",
          "No saved tokens found. Please enter your API tokens."
        ).toResponse() as NextResponse<McpAtlassianInitResponse>;
      }

      // Use saved tokens
      effectiveToken =
        savedSession.accessToken ||
        savedSession.jiraToken ||
        savedSession.confluenceToken ||
        "";

      if (!effectiveToken) {
        return new ChatSDKError(
          "bad_request:api",
          "No saved tokens found. Please enter your API tokens."
        ).toResponse() as NextResponse<McpAtlassianInitResponse>;
      }
    }

    const mcpConfig: McpSessionConfig = {
      baseUrl: mcpBaseUrl,
      accessToken: effectiveToken,
      userId: session.user.id,
    };

    // Initialize the MCP session using generic client
    const sessionId = await initializeMcpSession(mcpConfig);

    // Send the initialized notification
    await sendInitializedNotification(mcpConfig, sessionId);

    // Store the session in database (tokens stored securely server-side)
    // Only save new tokens if provided, otherwise keep existing
    await createMcpSession({
      userId: session.user.id,
      sessionId,
      accessToken: jiraToken || confluenceToken || accessToken || null,
      jiraToken: jiraToken || null,
      confluenceToken: confluenceToken || null,
      serverUrl: mcpBaseUrl,
      serverName: "atlassian",
    });

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("MCP Atlassian initialization error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse() as NextResponse<McpAtlassianInitResponse>;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/atlassian
 *
 * Check if the current user has an active MCP Atlassian session.
 * Checks the database for stored credentials (tokens persist across restarts).
 */
export async function GET(): Promise<
  NextResponse<{ hasActiveSession: boolean }>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ hasActiveSession: false });
    }

    // Check if there's a valid session stored in the database (check for both "atlassian" and "confluence")
    // Tokens persist across server restarts
    const sessions = await getAllMcpSessionsByUserId({
      userId: session.user.id,
    });
    const hasSession = sessions.some(
      (s) =>
        (s.serverName === "atlassian" ||
          s.serverName === "jira" ||
          s.serverName === "confluence") &&
        (s.accessToken || s.jiraToken || s.confluenceToken)
    );

    return NextResponse.json({ hasActiveSession: hasSession });
  } catch (error) {
    console.error("MCP Atlassian session check error:", error);
    return NextResponse.json({ hasActiveSession: false });
  }
}
