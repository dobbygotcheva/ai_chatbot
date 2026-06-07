// Vector Search Port - Shared layer
// Defines vector search capabilities that Context needs
// Infrastructure implements this using Qdrant

export interface VectorSearchInput {
  query: string;
  limit?: number;
  filter?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * Vector Search Port
 * Implemented by infrastructure using Qdrant
 */
export interface VectorSearchPort {
  search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
  generateEmbedding(text: string): Promise<number[]>;
}
