// Qdrant Adapter - Infrastructure layer
// Implements VectorSearchPort using Qdrant client
// This is the ONLY place that directly uses Qdrant

import { QdrantClient } from "@qdrant/js-client-rest";
import type {
  VectorSearchInput,
  VectorSearchPort,
  VectorSearchResult,
} from "../../shared/vector/vector.port";

export class QdrantAdapter implements VectorSearchPort {
  readonly client: QdrantClient;
  readonly collectionName: string;

  constructor(url: string, collectionName: string) {
    this.client = new QdrantClient({ url });
    this.collectionName = collectionName;
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResult[]> {
    // Generate embedding for the query
    const vector = await this.generateEmbedding(input.query);

    // Search Qdrant
    const results = await this.client.search(this.collectionName, {
      vector,
      limit: input.limit ?? 5,
      filter: input.filter ? this.buildFilter(input.filter) : undefined,
      with_payload: true,
      with_vector: false,
    });

    return results.map((r) => ({
      id: r.id as string,
      content: (r.payload?.content as string) ?? "",
      metadata: (r.payload?.metadata as Record<string, unknown>) ?? {},
      score: r.score,
    }));
  }

  generateEmbedding(_text: string): Promise<number[]> {
    // Would call embedding service (OpenAI, etc.)
    // For now, placeholder
    return Promise.resolve(new Array(1536).fill(0).map(() => Math.random()));
  }

  private buildFilter(
    filter: Record<string, unknown>
  ): Record<string, unknown> {
    // Convert generic filter to Qdrant filter format
    return filter;
  }
}
