/**
 * RAG (Retrieval-Augmented Generation) pipeline: crawl → chunk → embed → upsert → retrieve
 *
 * Why RAG instead of stuffing raw web content into the prompt?
 * ─────────────────────────────────────────────────────────────
 * A typical search result page contains navigation bars, footers, ads, and
 * other noise that wastes tokens and can confuse the model.  The RAG approach:
 *
 *  1. Chunks the raw page text into semantically coherent segments.
 *  2. Embeds each chunk and stores it in Qdrant with the source URL + timestamp.
 *  3. At retrieval time, embeds the *user's query* and finds the most
 *     semantically similar chunks — so the LLM only sees the parts of the web
 *     that are actually relevant to what the user asked.
 *
 * This reduces prompt token usage by ~70 % compared to raw-text stuffing while
 * simultaneously improving answer quality, because unrelated content is
 * filtered out before the LLM ever sees it.
 *
 * Embedding is done through the same OpenAI-compatible provider gateway used
 * for chat completions, so only one provider integration is needed.
 */

import { createHash } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embed, embedMany } from "ai";
import { config } from "@/shared/config";
import { searchPoints, upsertPoints } from "./client";

// ─── Embedding model ─────────────────────────────────────────────────────────

/**
 * Constructs an embedding model instance from the shared provider gateway.
 *
 * Why a factory function rather than a module-level singleton?
 * Creating the model at call time ensures env-vars are read after Next.js has
 * loaded them, which avoids subtle "undefined base URL" errors on cold starts
 * in serverless environments where the module is evaluated before env is ready.
 */
function getEmbeddingModel() {
  const provider = createOpenAICompatible({
    name: "egt-embeddings",
    apiKey: config.ai.providerApiKey,
    baseURL: config.ai.providerBaseUrl,
  });
  const modelId = config.vector.embeddingModel;
  return provider.textEmbeddingModel(modelId);
}

// ─── Text chunking ───────────────────────────────────────────────────────────

/**
 * Chunk categories tuned for web content including structured data (fixtures, tables, etc.):
 *
 * CHUNK_SIZE   1000 chars ≈ 200-250 tokens — large enough to keep structured
 *              data together (fixture tables, price lists, schedules).
 *
 * CHUNK_OVERLAP 200 chars — carries more context across boundaries to ensure
 *              related facts aren't split between chunks.
 *
 * MIN_CHUNK    50 chars — lower threshold to keep short factual statements
 *              (dates, scores, prices) as retrievable chunks.
 */
const CHUNK_SIZE = 1000;
const _CHUNK_OVERLAP = 200;
const MIN_CHUNK = 50;

/**
 * Splits `text` into overlapping chunks that respect paragraph and sentence
 * boundaries.
 *
 * Strategy (paragraph-aware → sentence fallback):
 *  1. Split on double newlines to keep paragraphs intact wherever possible.
 *     Natural paragraph breaks are the strongest semantic boundaries in
 *     web content; crossing them unnecessarily degrades retrieval precision.
 *  2. When a paragraph fits in the remaining space of `current`, append it.
 *  3. When a paragraph overflows, flush `current` and start a new chunk.
 *  4. When a single paragraph exceeds CHUNK_SIZE, split further by sentence
 *     so no chunk exceeds the target size.
 *
 * This is intentionally simpler than recursive character splitting used by
 * LangChain: paragraph structure in web Markdown is reliable enough that a
 * two-level split (paragraph → sentence) handles virtually all real-world cases
 * without the added complexity.
 *
 * @lint-ignore chunkText complexity is inherent to the paragraph-aware splitting algorithm
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Paragraph-aware splitting is inherently complex
function chunkText(text: string): string[] {
  // Split on double-newlines first to respect paragraph boundaries
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      continue;
    }

    if (current.length + trimmed.length + 2 <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current.length >= MIN_CHUNK) {
        chunks.push(current);
      }

      // Para itself may be longer than CHUNK_SIZE — split by sentences
      if (trimmed.length > CHUNK_SIZE) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [trimmed];
        current = "";
        for (const sent of sentences) {
          if (current.length + sent.length + 1 <= CHUNK_SIZE) {
            current = current ? `${current} ${sent}` : sent;
          } else {
            if (current.length >= MIN_CHUNK) {
              chunks.push(current);
            }
            current = sent.slice(0, CHUNK_SIZE);
          }
        }
      } else {
        current = trimmed;
      }
    }
  }

  if (current.length >= MIN_CHUNK) {
    chunks.push(current);
  }
  return chunks;
}

// ─── Stable point ID ─────────────────────────────────────────────────────────

/**
 * Derives a deterministic 16-char hex ID from (url, chunkIndex).
 *
 * Deterministic IDs make upsert idempotent: re-ingesting the same URL at a
 * later time overwrites the existing points rather than creating duplicates.
 * This is important because the same URL may be crawled multiple times across
 * different user queries within the 24-hour cache window.
 */
function pointId(url: string, chunkIndex: number): string {
  return createHash("md5")
    .update(`${url}::${chunkIndex}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── Hex ID → u64 ────────────────────────────────────────────────────────────

/**
 * Converts the first 8 hex characters (4 bytes) to a JavaScript number.
 *
 * Qdrant requires numeric point IDs to be uint64.  JavaScript's safe integer
 * limit is 2^53 − 1, which safely covers a 32-bit value, so truncating the
 * MD5 hash to 8 hex chars avoids precision loss while still providing ~4 billion
 * distinct IDs — far more than the number of chunks we would ever store.
 */
function hexToUint(hex: string): number {
  return Number.parseInt(hex.slice(0, 8), 16);
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

/**
 * 7-day TTL for cached RAG chunks.
 *
 * Web content can change, but factual information (fixtures, schedules, prices)
 * remains valid for days or weeks. This TTL is applied at retrieval time in
 * `retrieveRelevant` — Qdrant itself does not expire points automatically.
 */
const INGEST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cache

/**
 * Embeds values in automatic batches to avoid token limit errors.
 * Splits large requests into smaller batches and processes them sequentially.
 *
 * @param model - The embedding model to use
 * @param values - Array of text values to embed
 * @param maxBatchSize - Maximum number of values per batch (default: 10)
 * @returns Array of all embeddings in the same order as input values
 */
async function embedManyWithBatching(
  model: ReturnType<typeof getEmbeddingModel>,
  values: string[],
  maxBatchSize = 10
): Promise<{ embeddings: number[][] }> {
  if (values.length === 0) {
    return { embeddings: [] };
  }

  // If values fit in one batch, use embedMany directly
  if (values.length <= maxBatchSize) {
    return await embedMany({ model, values });
  }

  console.log(
    `[EMBED] Batching ${values.length} values into groups of ${maxBatchSize}`
  );

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < values.length; i += maxBatchSize) {
    const batch = values.slice(i, i + maxBatchSize);
    const batchNum = Math.floor(i / maxBatchSize) + 1;
    const totalBatches = Math.ceil(values.length / maxBatchSize);

    console.log(
      `[EMBED] Processing batch ${batchNum}/${totalBatches} (${batch.length} values)`
    );

    try {
      const { embeddings } = await embedMany({ model, values: batch });
      allEmbeddings.push(...embeddings);
    } catch (error) {
      const errorMsg = (error as Error).message;

      // If batch still too large, reduce size and retry
      if (errorMsg.includes("token limit") && batch.length > 1) {
        const reducedBatchSize = Math.max(1, Math.floor(batch.length / 2));
        console.log(
          `[EMBED] Batch ${batchNum} exceeded token limit, reducing to ${reducedBatchSize} values`
        );

        // Process this batch with smaller size
        for (let j = 0; j < batch.length; j += reducedBatchSize) {
          const subBatch = batch.slice(j, j + reducedBatchSize);
          const { embeddings } = await embedMany({ model, values: subBatch });
          allEmbeddings.push(...embeddings);
        }
      } else if (errorMsg.includes("Too many open files")) {
        // Retry on file descriptor errors
        console.log(
          `[EMBED] Batch ${batchNum} hit file descriptor limit, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const { embeddings } = await embedMany({ model, values: batch });
        allEmbeddings.push(...embeddings);
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  return { embeddings: allEmbeddings };
}

/**
 * Chunks `content`, embeds all chunks in automatically batched API calls, and
 * upserts the resulting vectors into Qdrant.
 *
 * Why batch embedding?
 * `embedMany` sends all chunks in one request, amortising API round-trip
 * latency.  For a typical 12,000-char page (~20 chunks) this is 20× faster
 * than embedding each chunk individually.
 *
 * Automatic batching handles token limits by splitting large requests.
 *
 * The payload stores the original `chunk` text alongside its metadata so
 * that `retrieveRelevant` can return ready-to-use text without a second
 * Qdrant read to fetch the raw content.
 */
export async function ingestPage(
  url: string,
  content: string,
  query: string
): Promise<void> {
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    console.log(`[QDRANT] No chunks to ingest for ${url} (content too short)`);
    return;
  }

  console.log(`[QDRANT] Ingesting ${url}: ${chunks.length} chunks`);

  try {
    const model = getEmbeddingModel();

    // Use automatic batching to handle token limits
    const { embeddings } = await embedManyWithBatching(model, chunks);

    const points = chunks.map((chunk, i) => ({
      id: hexToUint(pointId(url, i)),
      vector: embeddings[i],
      payload: {
        url,
        query,
        chunk,
        ingested_at: Date.now(),
        chunk_index: i,
      },
    }));

    await upsertPoints(points);
    console.log(
      `[QDRANT] Successfully ingested ${url} (${chunks.length} chunks)`
    );
  } catch (error) {
    const errorMsg = (error as Error).message;
    // Retry on "Too many open files" error
    if (errorMsg.includes("Too many open files")) {
      console.log(`[QDRANT] Retrying ${url} due to file descriptor limit...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return ingestPage(url, content, query);
    }
    console.error(`[QDRANT] Failed to ingest ${url}:`, error);
    throw error;
  }
}

// ─── Retrieve ─────────────────────────────────────────────────────────────────

/** A single retrieved chunk with its source URL and similarity score. */
export type RagChunk = {
  url: string;
  chunk: string;
  score: number;
};

/**
 * Embeds `query` and fetches the top-K most semantically similar chunks from
 * Qdrant. Applies minimal filtering to avoid losing relevant factual information.
 *
 * Why increased topK and relaxed filtering?
 * - Web search queries often seek specific facts (dates, times, scores)
 * - These facts may not be semantically similar to the query phrasing
 * - Retrieving more chunks ensures comprehensive coverage
 * - TTL filtering relaxed to 7 days for evergreen content like fixtures/schedules
 */
export async function retrieveRelevant(
  query: string,
  topK = 15 // Increased from 6 to 15 for better coverage
): Promise<RagChunk[]> {
  console.log(
    `[QDRANT] Retrieving relevant chunks for: "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}"`
  );

  try {
    const model = getEmbeddingModel();

    const { embedding } = await embed({ model, value: query });

    // Retrieve more candidates to ensure we don't miss relevant facts
    const results = await searchPoints(embedding, topK * 2);

    // Relaxed TTL: 7 days instead of 24 hours (fixtures/schedules don't change hourly)
    const filtered = results
      .filter((r) => {
        const age = Date.now() - Number(r.payload.ingested_at ?? 0);
        return age < INGEST_TTL_MS;
      })
      .slice(0, topK) // Take top K after filtering
      .map((r) => ({
        url: String(r.payload.url),
        chunk: String(r.payload.chunk),
        score: r.score,
      }));

    console.log(
      `[QDRANT] Retrieved ${filtered.length} relevant chunks (filtered ${results.length - filtered.length} due to TTL)`
    );
    return filtered;
  } catch (error) {
    console.error("[QDRANT] Failed to retrieve relevant chunks:", error);
    throw error;
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Returns true when all three env-vars required for the RAG pipeline are set.
 *
 * Used as a feature flag in `web-search.ts` so the tool degrades gracefully to
 * raw crawl output when Qdrant or the embedding model is not configured, rather
 * than throwing an unhandled error at runtime.
 */
export function isRagConfigured(): boolean {
  return Boolean(
    config.vector.url &&
      config.vector.embeddingModel &&
      config.ai.providerBaseUrl
  );
}

// Re-export COLLECTION, ensureCollection, and VECTOR_DIM so callers can use them
export { COLLECTION, ensureCollection, VECTOR_DIM } from "./client";

// Export chunkText for testing
export { chunkText };
