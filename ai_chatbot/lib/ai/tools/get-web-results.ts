import { tool } from "ai";
import { z } from "zod";
import {
  ensureCollection,
  ingestPage,
  retrieveRelevant,
} from "@/lib/qdrant/rag";
import { config } from "@/shared/config";
import { calculateDomainAuthority } from "./constants";

export { DOMAIN_TIERS, TIER_SCORES } from "./constants";

export const webResultsInputSchema = z.object({
  search: z
    .string()
    .describe(
      "Search text (e.g., 'English towns bombed World War 2', 'Most interesting news this past week')"
    ),
  depth: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .describe(
      "Crawl depth (0-3). Default: 0 (fast). Use higher values for comprehensive research on complex topics."
    ),
});

// Type for Crawl4AI result object
interface CrawlResultObj {
  fit_markdown?: string;
  raw_markdown?: string;
}

// Scored URL for ranking
interface ScoredUrl {
  url: string;
  title: string;
  score: number;
}

/**
 * Extract URLs from DuckDuckGo search results markdown/HTML
 */
function extractUrlsFromSearch(
  markdown: string,
  html: string
): Array<{ url: string; title: string }> {
  const foundUrls = new Map<string, string>();

  // Extract from markdown first (better quality)
  const markdownUrlRegex = /\[([^\]]{10,})\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  match = markdownUrlRegex.exec(markdown);
  while (match !== null) {
    const text = match[1];
    const url = match[2];
    if (isValidExternalUrl(url, text)) {
      foundUrls.set(url, text);
    }
    match = markdownUrlRegex.exec(markdown);
  }

  // If not enough URLs found, try HTML
  if (foundUrls.size < 3) {
    const htmlUrlRegex = /href="(https?:\/\/[^"]+)"/g;
    match = htmlUrlRegex.exec(html);
    while (match !== null) {
      const url = match[1];
      const textMatch = html
        .slice(html.indexOf(url) - 100, html.indexOf(url) + 200)
        .match(/>([^<]{10,})</);
      const text = textMatch ? textMatch[1] : url;
      if (isValidExternalUrl(url, text)) {
        foundUrls.set(url, text);
      }
      match = htmlUrlRegex.exec(html);
    }
  }

  console.log(
    `[CRAWLER] Extracted ${foundUrls.size} valid URLs from search results`
  );

  return Array.from(foundUrls.entries()).map(([url, title]) => ({
    url,
    title,
  }));
}

/**
 * Check if URL is valid for crawling
 */
function isValidExternalUrl(url: string, _text: string): boolean {
  const blockedDomains = [
    "duckduckgo.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "youtube.com",
    "linkedin.com",
    "reddit.com",
  ];

  // Basic validation
  if (!url.startsWith("http")) {
    return false;
  }

  // Check for blocked domains
  if (blockedDomains.some((domain) => url.includes(domain))) {
    return false;
  }

  // Filter out navigation/utility links
  const blockedPatterns = [
    "/login",
    "/signup",
    "/account",
    "about:",
    "javascript:",
  ];
  if (blockedPatterns.some((pattern) => url.toLowerCase().includes(pattern))) {
    return false;
  }

  return true;
}

/**
 * Score URLs by relevance, authority, and freshness
 */
function scoreUrls(
  urls: Array<{ url: string; title: string }>,
  query: string
): ScoredUrl[] {
  const queryTerms = query
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 2);

  return urls
    .map(({ url, title }) => ({
      url,
      title,
      score: calculateUrlScore(url, title, queryTerms),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate URL relevance score
 */
function calculateUrlScore(
  url: string,
  title: string,
  queryTerms: string[]
): number {
  let score = 0;

  // Domain authority heuristics
  score += calculateDomainAuthority(url);

  // Title relevance (BM25-lite)
  const titleLower = title.toLowerCase();
  const matchedTerms = queryTerms.filter((term) => titleLower.includes(term));
  score += matchedTerms.length * 1.5;

  // URL path relevance
  const urlLower = url.toLowerCase();
  const urlMatchedTerms = queryTerms.filter((term) => urlLower.includes(term));
  score += urlMatchedTerms.length * 0.5;

  // Freshness signals in title
  const currentYear = new Date().getFullYear();
  const freshnessPatterns = [
    new RegExp(`${currentYear}|${currentYear - 1}`),
    /\b(today|yesterday|recent|latest|breaking|new)\b/i,
    /\b(this week|this month|this year)\b/i,
  ];
  if (freshnessPatterns.some((pattern) => pattern.test(title))) {
    score += 2;
  }

  // Prefer HTTPS
  if (url.startsWith("https://")) {
    score += 0.5;
  }

  // Penalize very long URLs (likely low quality)
  if (url.length > 150) {
    score -= 1;
  }

  return score;
}

export const getWebResults = tool({
  description:
    "Search the web and get page content as markdown using Crawl4AI. " +
    "Provide a search query and optionally specify crawl depth (0-3). " +
    "Use depth=0 for quick facts/news (default, ~10s), depth=1-2 for moderate research, depth=3 for comprehensive analysis. " +
    "Returns markdown from the crawled pages.",
  inputSchema: webResultsInputSchema,
  needsApproval: false,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: API handler coordinates search, crawling, parallel processing, RAG retrieval, and error handling
  execute: async (input) => {
    const startTime = performance.now();
    const checkpoint = (label: string) => {
      const now = performance.now();
      const elapsed = ((now - startTime) / 1000).toFixed(2);
      console.log(`[⏱️ CHECKPOINT] ${label} - ${elapsed}s`);
    };

    if (!input.search) {
      return { error: "Please provide search text." };
    }

    const search = input.search;
    const depth = input.depth ?? 1; // Default to 1 for comprehensive coverage
    const crawlUrl = config.crawler.url?.trim() ?? "";
    const searchAsKeywords = search.trim().split(" ");

    if (!crawlUrl) {
      return {
        markdown: "",
        html: "",
        error:
          "Web crawler is not configured. Set CRAWLER_URL in .env.local (e.g. http://localhost:11235/crawl for Crawl4AI) and restart the app.",
      };
    }

    try {
      // Step 1: Fetch search results page using Crawl4AI (handles JavaScript/CAPTCHA)
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(search)}`;
      console.log(`[CRAWLER] Search query: ${search}`);
      console.log(`[CRAWLER] Search URL: ${searchUrl}`);
      checkpoint("Starting DuckDuckGo search");

      // Add timeout for search page crawl
      const searchController = new AbortController();
      const searchTimeoutId = setTimeout(
        () => searchController.abort(),
        15 * 1000
      );

      const searchResponse = await fetch(crawlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: searchController.signal,
        body: JSON.stringify({
          urls: [searchUrl],
          browser_config: {
            type: "BrowserConfig",
            params: {
              headless: true,
              viewport: { width: 1920, height: 1080 },
            },
          },
          crawler_config: {
            type: "CrawlerRunConfig",
            params: {
              cache_mode: "ENABLED",
              delay_before_return_html: 0.3,
              override_navigator: true,
              simulate_user: true,
              remove_overlay_elements: true,
              exclude_social_media_links: true,
            },
          },
        }),
      });

      clearTimeout(searchTimeoutId);

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const searchResults = Array.isArray(searchData)
        ? searchData
        : searchData.results || [];

      if (!searchResults[0]) {
        return { markdown: "", html: "", error: "No search results found" };
      }
      checkpoint("Search page crawled");

      // Extract and score URLs from DuckDuckGo search results
      const searchResultData = searchResults[0];
      const markdown = searchResultData.markdown || "";
      const html = searchResultData.html || "";

      // Extract all candidate URLs with metadata
      const candidateUrls = extractUrlsFromSearch(markdown, html);

      // Score and rank URLs by relevance and quality
      const scoredUrls = scoreUrls(candidateUrls, search);

      // Select top 5 URLs for comprehensive coverage
      const externalUrls = scoredUrls.slice(0, 5).map((u) => u.url);

      checkpoint(`URLs extracted: ${externalUrls.length} selected`);

      console.log(
        `[CRAWLER] Found ${externalUrls.length} external links (depth=${depth}):`,
        externalUrls
      );

      if (externalUrls.length === 0) {
        return { markdown: "", html: "", error: "No external links found" };
      }

      // Step 2: Crawl external URLs in parallel (much faster than sequential)
      console.log(
        `[CRAWLER] Starting parallel crawl of ${externalUrls.length} URLs...`
      );
      checkpoint("Starting URL crawling");

      // Ensure the collection exists once before ingesting any pages
      await ensureCollection().catch((err) => {
        console.error("[QDRANT] Failed to ensure collection:", err);
      });

      // Crawl all URLs in parallel for 3x speedup
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parallel crawler handles timeouts, retries, content extraction, and Qdrant ingestion for each URL
      const crawlPromises = externalUrls.map(async (url) => {
        console.log(`[CRAWLER] Crawling: ${url}`);

        // Ultra-aggressive timeout for speed (5s for depth=0, 15s for deeper)
        const controller = new AbortController();
        const timeoutMs = depth === 0 ? 5 * 1000 : 15 * 1000;
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
                        type: "BM25ContentFilter", // BM25 algorithm for text relevance scoring
                        params: {
                          user_query: search, // Search query used to filter and rank content
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
                            max_pages: depth === 1 ? 5 : depth === 2 ? 8 : 12,
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
            const rawMarkdown =
              result.markdown || result.extracted_content || "";
            const markdown =
              rawMarkdown.fit_markdown || rawMarkdown.raw_markdown || "";
            if (markdown && markdown.trim().length > 0) {
              await ingestPage(url, markdown, search).catch((err) => {
                console.error(`[QDRANT] Failed to ingest ${url}:`, err);
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
        markdown?: string;
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

      for (const result of crawledResults) {
        const rawMarkdown = result.markdown || result.extracted_content || "";

        // Handle both string and object markdown formats
        const processedMarkdown =
          typeof rawMarkdown === "string"
            ? rawMarkdown
            : String(
                (rawMarkdown as CrawlResultObj).fit_markdown ||
                  (rawMarkdown as CrawlResultObj).raw_markdown ||
                  ""
              );

        if (processedMarkdown && processedMarkdown.trim().length > 0) {
          // Reduce empty space: collapse multiple spaces/tabs to single space, multiple newlines to double newline
          const cleaned = processedMarkdown
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n/g, "\n\n");
          markdownContents.push(cleaned);
        }
      }

      // Return RAG-retrieved content with improvements for factual queries
      let finalMarkdown: string;
      try {
        const chunks = await retrieveRelevant(search, 15); // Get 15 chunks (increased from 6)
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
          finalMarkdown = `SEARCH_RESULTS_START\nFound ${deduped.length} relevant sources for "${search}":\n\n${results}\n\nSEARCH_RESULTS_END\n\nExtract specific facts, dates, times, prices, or other information from the Content sections above to answer the user's question.`;
          console.log(`[QDRANT] Using RAG: ${deduped.length} chunks`);
          checkpoint("RAG retrieval completed");
        } else if (markdownContents.length > 0) {
          // Fallback to crawled content if RAG returns nothing
          finalMarkdown = `SEARCH_RESULTS_START\nFound ${markdownContents.length} sources:\n\n${markdownContents.join("\n\n---\n\n")}\n\nSEARCH_RESULTS_END`;
          checkpoint("Fallback to crawled content");
        } else {
          finalMarkdown =
            "Search completed but no content was retrieved from the websites.";
          checkpoint("No content found");
        }
      } catch (err) {
        console.error("[QDRANT] retrieveRelevant failed:", err);
        // Fallback: return crawled content
        if (markdownContents.length > 0) {
          finalMarkdown = `SEARCH_RESULTS_START\nFound ${markdownContents.length} sources:\n\n${markdownContents.join("\n\n---\n\n")}\n\nSEARCH_RESULTS_END`;
        } else {
          finalMarkdown =
            "Search completed but no content was retrieved from the websites.";
        }
        checkpoint("RAG error, using fallback");
      }

      // Limit to maximum 60000 characters (fits comfortably in 200k token context)
      // This allows comprehensive search results for better answers
      const charLimit = 60_000;
      if (finalMarkdown.length > charLimit) {
        console.log(
          `[CRAWLER] Result is too big: ${finalMarkdown.length} characters. Shortening to ${charLimit}`
        );
        finalMarkdown = finalMarkdown.slice(0, charLimit);
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
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      let cause = "";
      if (err.cause instanceof Error) {
        cause = err.cause.message;
      } else if (err.cause !== undefined) {
        cause = String(err.cause);
      }
      const combined = `${err.message}${cause ? ` (${cause})` : ""}`;
      console.error(`Crawl4AI request failed: ${combined}`);
      const isUnreachable =
        combined.includes("fetch failed") ||
        combined.includes("ECONNREFUSED") ||
        combined.includes("ENOTFOUND") ||
        combined.includes("ETIMEDOUT") ||
        combined.includes("aborted");
      const hint = isUnreachable
        ? ` Check that Crawl4AI is running, reachable from this machine, and CRAWLER_URL (${crawlUrl}) is correct (see .env.example).`
        : "";
      return {
        markdown: "",
        html: "",
        error: `Failed to crawl: ${err.message}${hint}`,
      };
    }
  },
});

// Export helper functions for testing
export { calculateUrlScore, extractUrlsFromSearch, isValidExternalUrl };
