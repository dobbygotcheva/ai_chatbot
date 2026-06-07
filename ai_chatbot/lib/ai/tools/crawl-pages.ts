import { tool } from "ai";
import { z } from "zod";
import {
  ensureCollection,
  ingestPage,
  retrieveRelevant,
} from "@/lib/qdrant/rag";
import { config } from "@/shared/config";
import {
  BASE_TIMEOUT_MS,
  MAX_PAGES_BY_DEPTH,
  MAX_RESULT_CHARS,
  tokenizeQuery,
} from "./constants";

// Type for Crawl4AI result object
interface CrawlResultObj {
  fit_markdown?: string;
  raw_markdown?: string;
}

/**
 * Type guard to check if an object is a CrawlResultObj
 */
function isCrawlResultObj(obj: unknown): obj is CrawlResultObj {
  return (
    typeof obj === "object" &&
    obj !== null &&
    ("fit_markdown" in obj || "raw_markdown" in obj)
  );
}

export const crawlPagesInputSchema = z.object({
  urls: z
    .array(z.string().url())
    .min(1)
    .describe("Array of URLs to crawl (e.g., ['https://example.com/page1'])"),
  depth: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .describe("Crawl depth (0-3). Default: 0."),
  searchQuery: z
    .string()
    .describe(
      "Search query for RAG retrieval (e.g., 'Typhoons in Europe 2026'). REQUIRED - used to index and retrieve webpage content."
    ),
});

export const crawlPages = tool({
  description:
    "Crawl specific webpages and extract their content as markdown. " +
    "This tool extracts full page content from provided URLs. " +
    "Use this after find-webpages to read the content of discovered URLs, or when you already know which URLs to crawl. " +
    "Provide URLs and optionally specify crawl depth for following links within the site.",
  inputSchema: crawlPagesInputSchema,
  needsApproval: false,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: API handler coordinates crawling, parallel processing, RAG retrieval, and error handling
  execute: async (input) => {
    const startTime = performance.now();
    const checkpoint = (label: string) => {
      const now = performance.now();
      const elapsed = ((now - startTime) / 1000).toFixed(2);
      console.log(`[⏱️ CHECKPOINT] ${label} - ${elapsed}s`);
    };

    if (!input.urls || input.urls.length === 0) {
      return { error: "Please provide at least one URL to crawl." };
    }

    const urls = input.urls;
    const depth = input.depth ?? 0;
    const searchQuery = input.searchQuery;
    const crawlUrl = config.crawler.url || "";
    // Use tokenizeQuery for better keyword extraction (filters stopwords, punctuation)
    const searchAsKeywords = tokenizeQuery(searchQuery);

    // Remove duplicate URLs while preserving order
    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length < urls.length) {
      console.log(
        `[CRAWLER] Removed ${urls.length - uniqueUrls.length} duplicate URLs`
      );
    }

    // Track warnings for Qdrant failures
    const warnings: string[] = [];

    try {
      console.log(
        `[CRAWLER] Starting parallel crawl of ${uniqueUrls.length} unique URLs...`
      );
      checkpoint("Starting URL crawling");

      // Ensure the collection exists once before ingesting any pages
      await ensureCollection().catch((err) => {
        console.error("[QDRANT] Failed to ensure collection:", err);
        warnings.push("Qdrant collection not available - RAG disabled");
      });

      // Crawl all URLs in parallel for 3x speedup
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parallel crawler handles timeouts, retries, content extraction, and Qdrant ingestion for each URL
      const crawlPromises = uniqueUrls.map(async (url) => {
        console.log(`[CRAWLER] Crawling: ${url}`);

        // Timeout for crawl operations - scaled by depth and max pages
        const controller = new AbortController();
        const maxPages = MAX_PAGES_BY_DEPTH[depth as 1 | 2 | 3] ?? 1;
        const timeoutMs =
          depth === 0 ? BASE_TIMEOUT_MS : BASE_TIMEOUT_MS * maxPages;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const crawlResponse = await fetch(crawlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              urls: [url],
              // Browser configuration: controls the headless browser behavior
              browser_config: {
                type: "BrowserConfig",
                params: {
                  // Run browser in headless mode (no visible UI)
                  headless: true,
                  // Viewport size: ensure consistent desktop rendering
                  viewport: { width: 1920, height: 1080 },
                },
              },
              // Crawler configuration: controls how pages are crawled and content is extracted
              crawler_config: {
                type: "CrawlerRunConfig",
                params: {
                  // Cache mode: "ENABLED" uses cached results, "BYPASS" forces fresh crawl, "DISABLED" prevents caching
                  cache_mode: "ENABLED",
                  // Image handling: exclude all images from the crawl (faster, less bandwidth)
                  exclude_all_images: true,
                  // Markdown generator: converts HTML to markdown format
                  markdown_generator: {
                    type: "DefaultMarkdownGenerator",
                    params: {
                      // Content filter: filters markdown content based on relevance to search query
                      content_filter: {
                        type: "BM25ContentFilter",
                        params: {
                          user_query: searchQuery, // Use search query for content filtering
                        },
                      },
                    },
                  },
                  // Deep crawl strategy: controls how the crawler follows links within the site
                  // Only enable deep crawling for depth > 0
                  ...(depth > 0
                    ? {
                        deep_crawl_strategy: {
                          type: "BestFirstCrawlingStrategy",
                          params: {
                            max_depth: depth,
                            max_pages:
                              MAX_PAGES_BY_DEPTH[depth as 1 | 2 | 3] ?? 12,
                            url_scorer: {
                              type: "KeywordRelevanceScorer",
                              params: {
                                keywords: searchAsKeywords,
                                weight: 1.5,
                              },
                            },
                            filter_chain: {
                              type: "FilterChain",
                              params: {
                                filters: [
                                  {
                                    type: "ContentTypeFilter",
                                    params: {
                                      allowed_types: ["text/html"],
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      }
                    : {}),
                  // Optimized delay for speed (reduced from 0.5/0.8)
                  delay_before_return_html: depth === 0 ? 0.3 : 0.6,
                  // Override navigator: spoof navigator properties to avoid bot detection
                  override_navigator: true,
                  // Simulate user: simulate mouse movements and interactions to trigger dynamic content
                  simulate_user: true,
                  // Remove overlay elements: dismiss popups, cookie banners, and modal overlays
                  remove_overlay_elements: true,
                  // Preserve HTTPS for internal links: don't follow HTTP links from HTTPS pages (security)
                  preserve_https_for_internal_links: true,
                  // Exclude social media links: skip links to known social media domains
                  exclude_social_media_links: true,
                },
              },
            }),
          });

          console.log(
            `[CRAWLER] Crawl response status: ${crawlResponse.status}`
          );

          if (!crawlResponse.ok) {
            const errorText = await crawlResponse.text();
            console.error(
              `[CRAWLER] Crawl failed with status ${crawlResponse.status}: ${errorText}`
            );
            return []; // Return empty array for this URL
          }

          const crawlData = await crawlResponse.json();
          const results = Array.isArray(crawlData)
            ? crawlData
            : crawlData.results || [];

          // Ingest crawled content into Qdrant
          for (const result of results) {
            const markdown =
              result.markdown?.fit_markdown ||
              result.markdown?.raw_markdown ||
              result.extracted_content ||
              "";
            if (markdown && markdown.trim().length > 0) {
              await ingestPage(url, markdown, searchQuery).catch((err) => {
                console.error(`[QDRANT] Failed to ingest ${url}:`, err);
                warnings.push(`Failed to ingest ${url} into Qdrant`);
              });
            }
          }

          clearTimeout(timeoutId);
          return results;
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`[CRAWLER] ${url} error:`, error);
          return [];
        }
      });

      // Wait for all crawls to complete in parallel
      const resultsArray: {
        markdown?: string | { fit_markdown?: string; raw_markdown?: string };
        extracted_content?: string;
        fit_markdown?: string;
        raw_markdown?: string;
      }[][] = await Promise.all(crawlPromises);
      const crawledResults = resultsArray.flat();

      console.log(
        `[CRAWLER] Crawl completed, ${crawledResults.length} total results`
      );
      checkpoint("URL crawling completed");

      // Process results - return markdown
      const markdownContents: string[] = [];
      const urlContents: Array<{ url: string; content: string }> = [];

      for (const result of crawledResults) {
        // rawMarkdown can be a string, an object with fit_markdown/raw_markdown, or undefined
        const rawMarkdown = result.markdown || result.extracted_content;

        // Handle both string and object markdown formats using type guard
        const processedMarkdown =
          typeof rawMarkdown === "string"
            ? rawMarkdown
            : rawMarkdown === undefined || rawMarkdown === null
              ? ""
              : isCrawlResultObj(rawMarkdown)
                ? String(
                    rawMarkdown.fit_markdown || rawMarkdown.raw_markdown || ""
                  )
                : "";

        if (processedMarkdown && processedMarkdown.trim().length > 0) {
          // Reduce empty space: collapse multiple spaces/tabs to single space, multiple newlines to double newline
          const cleaned = processedMarkdown
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n/g, "\n\n");
          markdownContents.push(cleaned);
          // Also store with URL for structured access
          const sourceUrl =
            (result as { url?: string }).url || urls[markdownContents.length];
          urlContents.push({ url: sourceUrl, content: cleaned });
        }
      }

      // Return RAG-retrieved content with improvements for factual queries
      let finalMarkdown: string;

      try {
        const chunks = await retrieveRelevant(searchQuery, 15); // Get 15 chunks (increased from 6)
        const seen = new Set<string>();
        const deduped = chunks
          .filter((c) => {
            const key = `${c.url}::${c.chunk.slice(0, 80)}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 10); // Take top 10 chunks

        if (deduped.length > 0) {
          // Return chunks with comprehensive content (1000 chars each)
          const results = deduped
            .map(
              (c, i) =>
                `[${i + 1}] ${c.url}\n    Content: ${c.chunk.slice(0, 1000)}`
            )
            .join("\n\n");
          finalMarkdown = `CRAWLED_CONTENT_START\nFound ${deduped.length} relevant chunks for "${searchQuery}" from ${urls.length} URLs:\n\n${results}\n\nCRAWLED_CONTENT_END\n\nExtract specific facts, dates, times, prices, or other information from the Content sections above.`;
          console.log(`[QDRANT] Using RAG: ${deduped.length} chunks`);
          checkpoint("RAG retrieval completed");
        } else if (markdownContents.length > 0) {
          // Fallback to crawled content if RAG returns nothing
          finalMarkdown = `CRAWLED_CONTENT_START\nCrawled ${urlContents.length} pages:\n\n${urlContents.map((uc, i) => `[${i + 1}] ${uc.url}\n\n${uc.content}`).join("\n\n---\n\n")}\n\nCRAWLED_CONTENT_END`;
          checkpoint("Fallback to crawled content");
        } else {
          finalMarkdown =
            "Crawling completed but no content was retrieved from the websites.";
          checkpoint("No content found");
        }
      } catch (err) {
        console.error("[QDRANT] retrieveRelevant failed:", err);
        // Fallback: return crawled content
        if (markdownContents.length > 0) {
          finalMarkdown = `CRAWLED_CONTENT_START\nCrawled ${urlContents.length} pages:\n\n${urlContents.map((uc, i) => `[${i + 1}] ${uc.url}\n\n${uc.content}`).join("\n\n---\n\n")}\n\nCRAWLED_CONTENT_END`;
        } else {
          finalMarkdown =
            "Crawling completed but no content was retrieved from the websites.";
        }
        checkpoint("RAG error, using fallback");
      }

      // Limit to maximum characters (fits comfortably in 200k token context)
      // This allows comprehensive search results for better answers
      if (finalMarkdown.length > MAX_RESULT_CHARS) {
        console.log(
          `[CRAWLER] Result is too big: ${finalMarkdown.length} characters. Shortening to ${MAX_RESULT_CHARS}`
        );
        finalMarkdown = finalMarkdown.slice(0, MAX_RESULT_CHARS);
      }

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(3);
      console.log(`[CRAWLER] Crawler took: ${duration} seconds`);
      console.log(
        `[CRAWLER] Returning ${finalMarkdown.length} characters of markdown`
      );
      checkpoint("COMPLETED");

      return {
        markdown: finalMarkdown,
        urlContents,
        totalCrawled: urlContents.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error(`Crawl4AI request failed: ${(error as Error).message}`);
      return {
        markdown: "",
        html: "",
        error: `Failed to crawl: ${(error as Error).message}`,
      };
    }
  },
});
