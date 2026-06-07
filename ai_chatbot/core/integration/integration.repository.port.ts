// Integration Repository Port - Core layer
// Defines integration/MCP domain database operations
// Infrastructure implements this using Drizzle ORM

import type { McpSession } from "../../lib/db/schema";

export interface IntegrationRepositoryPort {
  // McpSession operations
  findSessionById(id: string): Promise<McpSession | null>;
  findSessionsByUserId(userId: string): Promise<McpSession[]>;
  findSessionByUserIdAndServerName(
    userId: string,
    serverName: string
  ): Promise<McpSession | null>;
  createSession(data: {
    userId: string;
    sessionId: string;
    serverName: string;
    serverUrl: string;
    accessToken?: string | null;
    jiraToken?: string | null;
    confluenceToken?: string | null;
  }): Promise<McpSession>;
  updateSession(
    id: string,
    data: Partial<
      Pick<
        McpSession,
        | "accessToken"
        | "jiraToken"
        | "confluenceToken"
        | "serverUrl"
        | "lastUsedAt"
      >
    >
  ): Promise<McpSession | null>;
  deleteSession(id: string): Promise<boolean>;
  updateLastUsedAt(sessionId: string): Promise<boolean>;
}
