// Integration Repository Implementation - Infrastructure layer
// Implements IntegrationRepositoryPort using Drizzle ORM

import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IntegrationRepositoryPort } from "../../../core/integration/integration.repository.port";
import type * as schema from "../../../lib/db/schema";
import { type McpSession, mcpSession } from "../../../lib/db/schema";

export class IntegrationRepository implements IntegrationRepositoryPort {
  private readonly db: PostgresJsDatabase<typeof schema>;

  constructor(db: PostgresJsDatabase<typeof schema>) {
    this.db = db;
  }

  async findSessionById(id: string): Promise<McpSession | null> {
    const result = await this.db
      .select()
      .from(mcpSession)
      .where(eq(mcpSession.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findSessionsByUserId(userId: string): Promise<McpSession[]> {
    const result = await this.db
      .select()
      .from(mcpSession)
      .where(eq(mcpSession.userId, userId));
    return result;
  }

  async findSessionByUserIdAndServerName(
    userId: string,
    serverName: string
  ): Promise<McpSession | null> {
    const result = await this.db
      .select()
      .from(mcpSession)
      .where(
        and(
          eq(mcpSession.userId, userId),
          eq(mcpSession.serverName, serverName)
        )
      )
      .limit(1);
    return result[0] ?? null;
  }

  async createSession(data: {
    userId: string;
    sessionId: string;
    serverName: string;
    serverUrl: string;
    accessToken?: string | null;
    jiraToken?: string | null;
    confluenceToken?: string | null;
  }): Promise<McpSession> {
    const result = await this.db
      .insert(mcpSession)
      .values({
        ...data,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      } as typeof mcpSession.$inferInsert)
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create MCP session");
    }
    return result[0];
  }

  async updateSession(
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
  ): Promise<McpSession | null> {
    const result = await this.db
      .update(mcpSession)
      .set(data as Partial<typeof mcpSession.$inferSelect>)
      .where(eq(mcpSession.id, id))
      .returning();
    return result[0] ?? null;
  }

  async deleteSession(id: string): Promise<boolean> {
    const result = await this.db
      .delete(mcpSession)
      .where(eq(mcpSession.id, id))
      .returning();
    return result.length > 0;
  }

  async updateLastUsedAt(sessionId: string): Promise<boolean> {
    const result = await this.db
      .update(mcpSession)
      .set({ lastUsedAt: new Date() } as Partial<
        typeof mcpSession.$inferSelect
      >)
      .where(eq(mcpSession.sessionId, sessionId))
      .returning();
    return result.length > 0;
  }
}
