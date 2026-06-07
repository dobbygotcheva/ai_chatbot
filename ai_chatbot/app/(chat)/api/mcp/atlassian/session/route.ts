import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteMcpSessionByUserId,
  getAllMcpSessionsByUserId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import {
  getSessionByUserId,
  isValidSession,
  removeSessionByUserId,
} from "@/lib/mcp/client";

export interface McpSessionStatusResponse {
  isConnected: boolean;
  sessionId?: string;
  createdAt?: string;
  lastUsedAt?: string;
  error?: string;
}

export interface McpDisconnectResponse {
  success: boolean;
  error?: string;
}

/**
 * GET /api/mcp/atlassian/session
 *
 * Get the current MCP Atlassian session status for the authenticated user.
 */
export async function GET(): Promise<NextResponse<McpSessionStatusResponse>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ isConnected: false });
    }

    // Get all sessions and find Atlassian session (check for both "atlassian" and "confluence")
    const sessions = await getAllMcpSessionsByUserId({
      userId: session.user.id,
    });
    const dbSession = sessions.find(
      (s) =>
        s.serverName === "atlassian" ||
        s.serverName === "jira" ||
        s.serverName === "confluence"
    );

    if (!dbSession) {
      return NextResponse.json({ isConnected: false });
    }

    // Check if the in-memory session is still valid
    const inMemorySession = getSessionByUserId(session.user.id);

    if (!inMemorySession || !isValidSession(inMemorySession.sessionId)) {
      // Session exists in DB but not in memory (server restarted)
      // Return false - tokens are still in DB, user can reconnect
      return NextResponse.json({ isConnected: false });
    }

    return NextResponse.json({
      isConnected: true,
      sessionId: inMemorySession.sessionId,
      createdAt: inMemorySession.createdAt.toISOString(),
      lastUsedAt: inMemorySession.lastUsedAt.toISOString(),
    });
  } catch (error) {
    console.error("MCP session status error:", error);
    return NextResponse.json({
      isConnected: false,
      error: "Failed to check session status",
    });
  }
}

/**
 * DELETE /api/mcp/atlassian/session
 *
 * Disconnect the current MCP Atlassian session.
 * This removes both the in-memory session and the database record.
 */
export async function DELETE(): Promise<NextResponse<McpDisconnectResponse>> {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError(
        "unauthorized:chat"
      ).toResponse() as NextResponse<McpDisconnectResponse>;
    }

    removeSessionByUserId(session.user.id);

    for (const serverName of ["atlassian", "jira", "confluence"] as const) {
      await deleteMcpSessionByUserId({
        userId: session.user.id,
        serverName,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MCP session disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect session" },
      { status: 500 }
    );
  }
}
