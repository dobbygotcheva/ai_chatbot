import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAllMcpSessionsByUserId } from "@/lib/db/queries";
import {
  hasConfluenceMcpCredential,
  hasJiraMcpCredential,
} from "@/lib/mcp/atlassian-session-merge";

/**
 * GET /api/mcp/atlassian/tokens
 *
 * Check if the user has saved tokens in the database.
 * This is used to determine if they need to re-enter tokens or can just reconnect.
 */

export async function GET(): Promise<
  NextResponse<{
    hasSavedTokens: boolean;
    hasJiraToken: boolean;
    hasConfluenceToken: boolean;
  }>
> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({
        hasSavedTokens: false,
        hasJiraToken: false,
        hasConfluenceToken: false,
      });
    }

    try {
      const sessions = await getAllMcpSessionsByUserId({
        userId: session.user.id,
      });
      const hasJira = hasJiraMcpCredential(sessions);
      const hasConfluence = hasConfluenceMcpCredential(sessions);

      if (!(hasJira || hasConfluence)) {
        return NextResponse.json({
          hasSavedTokens: false,
          hasJiraToken: false,
          hasConfluenceToken: false,
        });
      }

      return NextResponse.json({
        hasSavedTokens: true,
        hasJiraToken: hasJira,
        hasConfluenceToken: hasConfluence,
      });
    } catch (_dbError) {
      // Table doesn't exist (migrations not run yet)
      return NextResponse.json({
        hasSavedTokens: false,
        hasJiraToken: false,
        hasConfluenceToken: false,
      });
    }
  } catch (error) {
    console.error("MCP tokens check error:", error);
    return NextResponse.json({
      hasSavedTokens: false,
      hasJiraToken: false,
      hasConfluenceToken: false,
    });
  }
}
