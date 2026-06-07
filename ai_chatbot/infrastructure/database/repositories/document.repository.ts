// Document Repository Implementation - Infrastructure layer
// Implements DocumentRepositoryPort using Drizzle ORM

import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { DocumentRepositoryPort } from "../../../core/document/document.repository.port";
import type * as schema from "../../../lib/db/schema";
import {
  type Document,
  document,
  type Suggestion,
  suggestion,
} from "../../../lib/db/schema";

export class DocumentRepository implements DocumentRepositoryPort {
  private readonly db: PostgresJsDatabase<typeof schema>;

  constructor(db: PostgresJsDatabase<typeof schema>) {
    this.db = db;
  }

  // Document operations
  async findDocumentById(
    id: string,
    createdAt: Date
  ): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.createdAt, createdAt)))
      .limit(1);
    return result[0] ?? null;
  }

  async findDocumentsByUserId(userId: string): Promise<Document[]> {
    const result = await this.db
      .select()
      .from(document)
      .where(eq(document.userId, userId));
    return result;
  }

  async createDocument(data: {
    title: string;
    content?: string;
    kind?: "text" | "code" | "image" | "sheet";
    userId: string;
  }): Promise<Document> {
    const result = await this.db
      .insert(document)
      .values({
        title: data.title,
        content: data.content,
        kind: data.kind ?? "text",
        userId: data.userId,
        createdAt: new Date(),
      } as typeof document.$inferInsert)
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create document");
    }
    return result[0];
  }

  async updateDocument(
    id: string,
    createdAt: Date,
    data: Partial<Pick<Document, "title" | "content" | "kind">>
  ): Promise<Document | null> {
    const result = await this.db
      .update(document)
      .set(data as Partial<typeof document.$inferSelect>)
      .where(and(eq(document.id, id), eq(document.createdAt, createdAt)))
      .returning();
    return result[0] ?? null;
  }

  async deleteDocument(id: string, createdAt: Date): Promise<boolean> {
    const result = await this.db
      .delete(document)
      .where(and(eq(document.id, id), eq(document.createdAt, createdAt)))
      .returning();
    return result.length > 0;
  }

  // Suggestion operations
  async findSuggestionById(id: string): Promise<Suggestion | null> {
    const result = await this.db
      .select()
      .from(suggestion)
      .where(eq(suggestion.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findSuggestionsByDocumentId(
    documentId: string,
    documentCreatedAt: Date
  ): Promise<Suggestion[]> {
    const result = await this.db
      .select()
      .from(suggestion)
      .where(
        and(
          eq(suggestion.documentId, documentId),
          eq(suggestion.documentCreatedAt, documentCreatedAt)
        )
      );
    return result;
  }

  async createSuggestion(data: {
    documentId: string;
    documentCreatedAt: Date;
    originalText: string;
    suggestedText: string;
    description?: string;
    userId: string;
  }): Promise<Suggestion> {
    const result = await this.db
      .insert(suggestion)
      .values({
        documentId: data.documentId,
        documentCreatedAt: data.documentCreatedAt,
        originalText: data.originalText,
        suggestedText: data.suggestedText,
        description: data.description,
        userId: data.userId,
        createdAt: new Date(),
        isResolved: false,
      } as typeof suggestion.$inferInsert)
      .returning();
    if (!result[0]) {
      throw new Error("Failed to create suggestion");
    }
    return result[0];
  }

  async resolveSuggestion(id: string): Promise<Suggestion | null> {
    const result = await this.db
      .update(suggestion)
      .set({ isResolved: true } as Partial<typeof suggestion.$inferSelect>)
      .where(eq(suggestion.id, id))
      .returning();
    return result[0] ?? null;
  }

  async deleteSuggestion(id: string): Promise<boolean> {
    const result = await this.db
      .delete(suggestion)
      .where(eq(suggestion.id, id))
      .returning();
    return result.length > 0;
  }
}
