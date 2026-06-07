// Drizzle Database Adapter - Infrastructure layer
// Implements DatabasePort using Drizzle ORM
// Provides domain-specific repositories for clean architecture

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// Domain repository ports
import type { AuthRepositoryPort } from "../../core/auth/auth.repository.port";
import type { ChatRepositoryPort } from "../../core/chat/chat.repository.port";
import type { DocumentRepositoryPort } from "../../core/document/document.repository.port";
import type { IntegrationRepositoryPort } from "../../core/integration/integration.repository.port";
// biome-ignore lint/performance/noNamespaceImport: Required by Drizzle ORM for type inference
import * as schema from "../../lib/db/schema";
import type { DatabasePort } from "../../shared/database/database.port";
// Domain-specific repositories
import { AuthRepository } from "./repositories/auth.repository";
import { ChatRepository } from "./repositories/chat.repository";
import { DocumentRepository } from "./repositories/document.repository";
import { IntegrationRepository } from "./repositories/integration.repository";

/**
 * DrizzleAdapter - Main database adapter providing:
 * 1. Generic database operations (legacy compatibility)
 * 2. Domain-specific repositories for clean architecture
 *
 * Migration path:
 * - Phase 1: Use generic methods (current)
 * - Phase 2: Use domain repositories (recommended)
 * - Phase 3: Remove generic methods when all code migrated
 */
export class DrizzleAdapter implements DatabasePort {
  readonly db: ReturnType<typeof drizzle<typeof schema>>;

  // Domain-specific repositories
  readonly auth: AuthRepositoryPort;
  readonly chat: ChatRepositoryPort;
  readonly document: DocumentRepositoryPort;
  readonly integration: IntegrationRepositoryPort;

  constructor(connectionString: string) {
    const client = postgres(connectionString);
    this.db = drizzle(client);

    // Initialize domain repositories
    this.auth = new AuthRepository(this.db);
    this.chat = new ChatRepository(this.db);
    this.document = new DocumentRepository(this.db);
    this.integration = new IntegrationRepository(this.db);
  }

  // ============================================================================
  // LEGACY GENERIC METHODS (to be deprecated)
  // ============================================================================

  // biome-ignore lint: Intentionally no await - throws immediately
  async query<T>(_sql: string, _params?: unknown[]): Promise<T[]> {
    // Raw query support - implementation depends on drizzle version
    // This is a legacy method, prefer using domain repositories
    throw new Error(
      "Raw queries not implemented. Use domain repositories instead."
    );
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    // Map table names to schema
    const tableMap: Record<string, unknown> = {
      users: schema.user,
      chats: schema.chat,
      messages: schema.message,
    };

    const tableSchema = tableMap[table];
    if (!tableSchema) {
      throw new Error(`Unknown table: ${table}`);
    }

    // Use type assertion for dynamic table access
    const result = await this.db
      .select()
      .from(tableSchema as never)
      .where(eq((tableSchema as { id: typeof schema.user.id }).id, id))
      .limit(1);

    return (result[0] as T) ?? null;
  }

  async findMany<T>(
    table: string,
    where: Record<string, unknown>
  ): Promise<T[]> {
    const tableMap: Record<string, unknown> = {
      users: schema.user,
      chats: schema.chat,
      messages: schema.message,
    };

    const tableSchema = tableMap[table];
    if (!tableSchema) {
      throw new Error(`Unknown table: ${table}`);
    }

    // Build where conditions
    const conditions = Object.entries(where).map(([key, value]) => {
      const column = (tableSchema as Record<string, unknown>)[key];
      return eq(column as never, value);
    });

    const result = await this.db
      .select()
      .from(tableSchema as never)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    return result as T[];
  }
}
