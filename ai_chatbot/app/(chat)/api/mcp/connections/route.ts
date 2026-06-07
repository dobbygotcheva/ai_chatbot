import { auth } from "@/app/(auth)/auth";
import {
  clearAtlassianMcpProductToken,
  createMcpSession,
  deleteMcpSessionByUserId,
  getAllMcpSessionsByUserId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import {
  hasConfluenceMcpCredential,
  hasJiraMcpCredential,
} from "@/lib/mcp/atlassian-session-merge";
import {
  CONFLUENCE_MCP_TOOL_NAMES,
  JIRA_MCP_TOOL_NAMES,
} from "@/lib/mcp/atlassian-tool-catalog";
import { config } from "@/shared/config";

/**
 * MCP app cards: Jira and Confluence share the same HTTP endpoint (ATLASSIAN_MCP)
 * but are shown as separate integrations with accurate tool lists from mcp-atlassian.
 */
const MCP_SERVERS = [
  {
    serverName: "jira" as const,
    displayName: "Jira",
    description:
      "Search issues with JQL, manage boards, sprints, transitions, and Jira Service Management.",
    icon: "jira" as const,
    configFields: [
      {
        key: "jiraToken",
        label: "Jira API token",
        type: "password" as const,
        required: true,
        helpText:
          "Create at https://id.atlassian.com/manage-profile/security/api-tokens",
      },
    ],
  },
  {
    serverName: "confluence" as const,
    displayName: "Confluence",
    description:
      "Search wiki content (CQL), read and edit pages, attachments, and comments.",
    icon: "confluence" as const,
    configFields: [
      {
        key: "confluenceToken",
        label: "Confluence API token",
        type: "password" as const,
        required: true,
        helpText:
          "Same Atlassian site as Jira; the same API token often works for both.",
      },
    ],
  },
];

function getServerUrl(serverName: string, userProvidedUrl?: string): string {
  if (
    serverName === "atlassian" ||
    serverName === "jira" ||
    serverName === "confluence"
  ) {
    return config.mcp.atlassian ?? "http://localhost:8000/mcp";
  }
  return userProvidedUrl ?? "";
}

function timestampsForJira(
  sessions: Awaited<ReturnType<typeof getAllMcpSessionsByUserId>>
) {
  const row =
    sessions.find((s) => s.serverName === "jira") ??
    (hasJiraMcpCredential(sessions)
      ? sessions.find((s) => s.serverName === "atlassian")
      : undefined);
  return { connectedAt: row?.createdAt, lastUsedAt: row?.lastUsedAt };
}

function timestampsForConfluence(
  sessions: Awaited<ReturnType<typeof getAllMcpSessionsByUserId>>
) {
  const row =
    sessions.find((s) => s.serverName === "confluence") ??
    (hasConfluenceMcpCredential(sessions)
      ? sessions.find((s) => s.serverName === "atlassian")
      : undefined);
  return { connectedAt: row?.createdAt, lastUsedAt: row?.lastUsedAt };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let mcpSessions: Awaited<ReturnType<typeof getAllMcpSessionsByUserId>> = [];
  try {
    mcpSessions = await getAllMcpSessionsByUserId({ userId: session.user.id });
  } catch {
    // Table may not exist yet — return all servers as disconnected
  }

  const enriched = MCP_SERVERS.map((server) => {
    if (server.serverName === "jira") {
      const { connectedAt, lastUsedAt } = timestampsForJira(mcpSessions);
      return {
        appId: server.serverName,
        name: server.displayName,
        description: server.description,
        icon: server.icon,
        category: "collaboration",
        authMethod: "apikey" as const,
        configFields: server.configFields,
        tools: [...JIRA_MCP_TOOL_NAMES],
        connected: hasJiraMcpCredential(mcpSessions),
        connectedAt: connectedAt?.toISOString(),
        lastUsedAt: lastUsedAt?.toISOString(),
      };
    }

    const { connectedAt, lastUsedAt } = timestampsForConfluence(mcpSessions);
    return {
      appId: server.serverName,
      name: server.displayName,
      description: server.description,
      icon: server.icon,
      category: "collaboration",
      authMethod: "apikey" as const,
      configFields: server.configFields,
      tools: [...CONFLUENCE_MCP_TOOL_NAMES],
      connected: hasConfluenceMcpCredential(mcpSessions),
      connectedAt: connectedAt?.toISOString(),
      lastUsedAt: lastUsedAt?.toISOString(),
    };
  });

  return Response.json(enriched);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let body: {
    serverName: string;
    serverUrl?: string;
    accessToken?: string;
    jiraToken?: string;
    confluenceToken?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const serverDef = MCP_SERVERS.find((s) => s.serverName === body.serverName);
  if (!serverDef) {
    return Response.json({ error: "Unknown server" }, { status: 400 });
  }

  if (body.serverName === "jira" && !body.jiraToken?.trim()) {
    return Response.json(
      { error: "Jira API token is required" },
      { status: 400 }
    );
  }
  if (body.serverName === "confluence" && !body.confluenceToken?.trim()) {
    return Response.json(
      { error: "Confluence API token is required" },
      { status: 400 }
    );
  }

  const serverUrl = getServerUrl(body.serverName, body.serverUrl);

  if (!serverUrl) {
    return Response.json({ error: "Server URL is required" }, { status: 400 });
  }

  const mcpSession = await createMcpSession({
    userId: session.user.id,
    sessionId: crypto.randomUUID(),
    serverUrl,
    serverName: body.serverName,
    accessToken: body.accessToken ?? null,
    jiraToken: body.serverName === "jira" ? (body.jiraToken ?? null) : null,
    confluenceToken:
      body.serverName === "confluence" ? (body.confluenceToken ?? null) : null,
  });

  return Response.json({ success: true, session: mcpSession }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const serverName = searchParams.get("serverName") as string | null;

  if (!serverName) {
    return Response.json({ error: "serverName required" }, { status: 400 });
  }

  if (serverName === "jira") {
    await deleteMcpSessionByUserId({
      userId: session.user.id,
      serverName: "jira",
    });
    await clearAtlassianMcpProductToken({
      userId: session.user.id,
      product: "jira",
    });
  } else if (serverName === "confluence") {
    await deleteMcpSessionByUserId({
      userId: session.user.id,
      serverName: "confluence",
    });
    await clearAtlassianMcpProductToken({
      userId: session.user.id,
      product: "confluence",
    });
  } else {
    return Response.json({ error: "Unknown server" }, { status: 400 });
  }

  return Response.json({ success: true });
}
