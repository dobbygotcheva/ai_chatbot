import type { McpSession } from "@/lib/db/schema";
import type { McpCredentials } from "@/lib/mcp/types";

/**
 * Merges DB rows for `atlassian`, `jira`, and `confluence` server names into one
 * credential bundle for the shared mcp-atlassian HTTP endpoint.
 */
export function mergeAtlassianMcpRows(
  sessions: McpSession[],
  userId: string
): McpCredentials {
  const atlassian = sessions.find((s) => s.serverName === "atlassian");
  const jira = sessions.find((s) => s.serverName === "jira");
  const confluence = sessions.find((s) => s.serverName === "confluence");

  const serverUrl =
    jira?.serverUrl ?? confluence?.serverUrl ?? atlassian?.serverUrl;
  if (!serverUrl) {
    throw new Error(
      "Atlassian MCP is not connected. Please connect Jira and/or Confluence in Settings > Apps."
    );
  }

  const jiraToken = jira?.jiraToken ?? atlassian?.jiraToken ?? null;
  const confluenceToken =
    confluence?.confluenceToken ?? atlassian?.confluenceToken ?? null;
  const accessToken =
    atlassian?.accessToken ??
    jira?.accessToken ??
    confluence?.accessToken ??
    null;

  const sessionId =
    atlassian?.sessionId ??
    (jiraToken ? jira?.sessionId : undefined) ??
    (confluenceToken ? confluence?.sessionId : undefined) ??
    jira?.sessionId ??
    confluence?.sessionId;

  if (!sessionId) {
    throw new Error(
      "Atlassian MCP is not connected. Please connect in Settings > Apps."
    );
  }

  const effectiveToken = jiraToken ?? confluenceToken ?? accessToken ?? "";

  return {
    userId,
    accessToken: accessToken ?? "",
    serverUrl,
    sessionId,
    jiraToken: jiraToken ?? undefined,
    confluenceToken: confluenceToken ?? undefined,
    effectiveToken,
  };
}

export function hasJiraMcpCredential(sessions: McpSession[]): boolean {
  return sessions.some(
    (s) =>
      (s.serverName === "atlassian" || s.serverName === "jira") &&
      !!(s.jiraToken || s.accessToken)
  );
}

export function hasConfluenceMcpCredential(sessions: McpSession[]): boolean {
  return sessions.some(
    (s) =>
      (s.serverName === "atlassian" || s.serverName === "confluence") &&
      !!(s.confluenceToken || s.accessToken)
  );
}

export function hasAnyAtlassianMcpCredential(sessions: McpSession[]): boolean {
  return hasJiraMcpCredential(sessions) || hasConfluenceMcpCredential(sessions);
}
