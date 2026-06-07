/**
 * MCP Atlassian Tools List API
 *
 * Returns the list of available tools from the Atlassian MCP server.
 * Uses the generic MCP tools handler with Atlassian-specific filtering.
 */

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAllMcpSessionsByUserId } from "@/lib/db/queries";
import { mergeAtlassianMcpRows } from "@/lib/mcp/atlassian-session-merge";
import { listMcpTools } from "@/lib/mcp/tools";
import type { McpCredentials } from "@/lib/mcp/types";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await getAllMcpSessionsByUserId({
      userId: session.user.id,
    });
    const atlassianRows = rows.filter(
      (s) =>
        s.serverName === "atlassian" ||
        s.serverName === "jira" ||
        s.serverName === "confluence"
    );

    if (!atlassianRows.length) {
      return NextResponse.json(
        { error: "Atlassian MCP is not connected" },
        { status: 404 }
      );
    }

    let credentials: McpCredentials;
    try {
      credentials = mergeAtlassianMcpRows(atlassianRows, session.user.id);
    } catch {
      return NextResponse.json(
        { error: "Atlassian MCP is not connected" },
        { status: 404 }
      );
    }

    const tools = await listMcpTools(credentials);

    // Filter to only include Atlassian tools (confluence_ and jira_ prefixes)
    const toolsList = tools.tools || tools;
    const atlassianTools = Array.isArray(toolsList)
      ? toolsList.filter((t: { name?: string }) => {
          const name = t.name?.toLowerCase();
          return (
            name?.startsWith("confluence_") ||
            name?.startsWith("jira_") ||
            name?.startsWith("atlassian_")
          );
        })
      : toolsList;

    return NextResponse.json({ success: true, tools: atlassianTools });
  } catch (error) {
    console.error("[MCP] Error listing tools:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list tools",
      },
      { status: 500 }
    );
  }
}
