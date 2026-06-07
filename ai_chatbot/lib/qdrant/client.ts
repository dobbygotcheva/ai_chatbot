/**
 * Lightweight Qdrant REST client — no external SDK required.
 *
 * Why no SDK?
 * The official @qdrant/js-client-rest package adds ~300 kB to the bundle and
 * pulls in several transitive dependencies.  The four operations we need
 * (create collection, upsert, search, health-check) map cleanly to four HTTP
 * calls, so a thin fetch wrapper keeps the deployment fast and dependency-free.
 *
 * All requests are authenticated via an optional `api-key` header so the same
 * code works against both a local Qdrant instance (no key) and Qdrant Cloud.
 */

import { VECTOR_DIM as _VECTOR_DIM, config } from "@/shared/config";

/** Single collection that holds all web-RAG embeddings for this app. */
export const COLLECTION = "web_rag";

/**
 * Vector dimension — must match the embedding model in use:
 *   embedding  → 1024 (default)
 *   text-embedding-3-small  → 1536
 *   nomic-embed-text        → 768
 *   ada-002                 → 1536
 *
 * Configurable via QDRANT_VECTOR_DIM so switching models only requires an
 * env-var change, not a code change.
 */
export const VECTOR_DIM = _VECTOR_DIM;

/** Returns the trimmed Qdrant base URL, throwing early if not configured. */
function base(): string {
  return config.vector.url.replace(/\/$/, "");
}

/**
 * Builds request headers.
 * The api-key header is only sent when QDRANT_API_KEY is present, so
 * unauthenticated local deployments work out of the box.
 */
function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.vector.apiKey) {
    h["api-key"] = config.vector.apiKey;
  }
  return h;
}

/**
 * Central fetch wrapper for all Qdrant HTTP calls.
 *
 * Throws a descriptive error that includes the HTTP method, path, status code,
 * and the first 300 characters of the response body — enough to diagnose most
 * issues without flooding logs with huge payloads.
 */
async function qdrantFetch(
  path: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Qdrant] ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`
    );
  }
  return res.json();
}

/**
 * Ensures the `web_rag` collection exists, creating it if necessary.
 *
 * Using a try/GET + catch/PUT pattern rather than a dedicated
 * "collection exists" endpoint keeps the code idempotent and safe to call on
 * every startup or cold-start without needing a separate migration step.
 *
 * `indexing_threshold: 0` forces Qdrant to build the HNSW index immediately
 * even for small datasets, which gives consistent latency from the first query.
 * Cosine distance is the standard choice for text embeddings because it
 * measures directional similarity independent of vector magnitude.
 */
export async function ensureCollection(): Promise<void> {
  try {
    await qdrantFetch(`/collections/${COLLECTION}`, "GET");
    console.log(`[QDRANT] Collection "${COLLECTION}" exists`);
  } catch {
    console.log(
      `[QDRANT] Collection "${COLLECTION}" does not exist, creating...`
    );
    await qdrantFetch(`/collections/${COLLECTION}`, "PUT", {
      vectors: {
        size: Number(VECTOR_DIM),
        distance: "Cosine",
      },
      optimizers_config: { indexing_threshold: 0 },
    });
    console.log(`[QDRANT] Collection "${COLLECTION}" created successfully`);
  }
}

/** A single vector point to be stored in Qdrant. */
export type QdrantPoint = {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
};

/**
 * Upserts (insert-or-update) a batch of points into the collection.
 *
 * `wait: false` makes the call return immediately after Qdrant acknowledges
 * receipt, rather than blocking until the segments are fully persisted.
 * This keeps ingestion non-blocking from the caller's perspective; the data
 * is durably queued on the Qdrant side and becomes searchable within
 * milliseconds.
 */
export async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  try {
    await qdrantFetch(`/collections/${COLLECTION}/points`, "PUT", {
      points,
      wait: false,
    });
    console.log(`[QDRANT] Successfully upserted ${points.length} points`);
  } catch (error) {
    console.error("[QDRANT] Failed to upsert points:", error);
    throw error;
  }
}

/** A result returned by a vector similarity search. */
export type SearchResult = {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
};

/**
 * Performs an approximate nearest-neighbour search over the collection.
 *
 * `score_threshold: 0.35` discards results whose cosine similarity is below
 * 0.35 (on a −1 … +1 scale).  In practice, chunks below this threshold are
 * semantically unrelated to the query and would only add noise to the LLM
 * context.  The value was chosen empirically: high enough to filter junk,
 * low enough to keep loosely related background context.
 *
 * An optional Qdrant filter expression can restrict results to a specific URL,
 * query, or time window without re-embedding — useful for scoped lookups.
 */
export async function searchPoints(
  vector: number[],
  limit: number,
  filter?: Record<string, unknown>
): Promise<SearchResult[]> {
  try {
    const body: Record<string, unknown> = {
      vector,
      limit,
      with_payload: true,
      score_threshold: 0.35,
    };
    if (filter) {
      body.filter = filter;
    }

    const res = (await qdrantFetch(
      `/collections/${COLLECTION}/points/search`,
      "POST",
      body
    )) as { result: SearchResult[] };

    const results = res.result ?? [];
    console.log(`[QDRANT] Search returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error("[QDRANT] Search failed:", error);
    throw error;
  }
}
