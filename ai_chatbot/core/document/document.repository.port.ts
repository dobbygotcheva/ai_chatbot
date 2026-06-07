// Document Repository Port - Core layer
// Defines document domain database operations
// Infrastructure implements this using Drizzle

import type { Document, Suggestion } from "../../lib/db/schema";

export interface DocumentRepositoryPort {
  // Document operations
  findDocumentById(id: string, createdAt: Date): Promise<Document | null>;
  findDocumentsByUserId(userId: string): Promise<Document[]>;
  createDocument(data: {
    title: string;
    content?: string;
    kind?: "text" | "code" | "image" | "sheet";
    userId: string;
  }): Promise<Document>;
  updateDocument(
    id: string,
    createdAt: Date,
    data: Partial<Pick<Document, "title" | "content" | "kind">>
  ): Promise<Document | null>;
  deleteDocument(id: string, createdAt: Date): Promise<boolean>;

  // Suggestion operations
  findSuggestionById(id: string): Promise<Suggestion | null>;
  findSuggestionsByDocumentId(
    documentId: string,
    documentCreatedAt: Date
  ): Promise<Suggestion[]>;
  createSuggestion(data: {
    documentId: string;
    documentCreatedAt: Date;
    originalText: string;
    suggestedText: string;
    description?: string;
    userId: string;
  }): Promise<Suggestion>;
  resolveSuggestion(id: string): Promise<Suggestion | null>;
  deleteSuggestion(id: string): Promise<boolean>;
}
