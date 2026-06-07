import { tool } from "ai";
import { z } from "zod";
import { config } from "@/shared/config";
import { calculateDomainAuthority, isValidCrawlUrl } from "./constants";

interface Url {
  url: string;
  title: string;
  description: string | undefined;
  category: string | undefined;
  publishedDate: string | undefined;
  score: number;
}

interface SearXNGSearchResponse {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content?: string;
    engine?: string;
    category?: string;
    publishedDate?: string;
    score?: number;
  }>;
  suggestions?: string[];
  answers?: string[];
}

export function isValidExternalUrl(url: string, _text: string): boolean {
  return isValidCrawlUrl(url);
}

function extractUrls(results: SearXNGSearchResponse["results"]): Url[] {
  return results
    .filter(
      (result) =>
        result.url &&
        result.title &&
        isValidExternalUrl(result.url, result.title)
    )
    .map((result) => ({
      url: result.url,
      title: result.title,
      description: result.content,
      category: result.category,
      publishedDate: result.publishedDate,
      score: (result.score ?? 0) + calculateDomainAuthority(result.url),
    }));
}

export const findWebpagesInputSchema = z.object({
  search: z
    .string()
    .describe(
      "Search text (e.g., 'English towns bombed World War 2', 'Most interesting news this past week')"
    ),
  limit: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe(
      "Number of URLs to return (1-10). Default: 5. Example: 5 (not '5' or 'five')."
    ),
  categories: z
    .array(z.string())
    .optional()
    .describe(
      "SearXNG categories to filter results. Available: general, news, science, it, images, videos, music, map, files, social media. Use ['news'] for current events, ['science'] for research, ['it'] for tech. Default: ['general'] (all categories)."
    ),
  timeRange: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe(
      "Filter results by recency. Values: 'day' (24h), 'week' (7 days), 'month' (30 days), 'year' (365 days). Use for time-sensitive queries like 'latest AI developments'."
    ),
  language: z
    .string()
    .optional()
    .describe(
      "Language code (ISO 639-1) for results. Examples: 'en' (English), 'bg' (Bulgarian), 'de' (German), 'fr' (French), 'es' (Spanish). Default: 'en'. Use when result will be more accurate if it's localised."
    ),
});

export const findWebpages = tool({
  description:
    "Search the web and return a list of relevant webpage URLs with metadata (title, description, category, published date). " +
    "This tool ONLY finds URLs - it does NOT crawl or extract page content. " +
    "Use this when you need to discover relevant webpages without reading their full content. " +
    "For comprehensive research, use this tool first to find URLs, then use crawl-pages to read their content. " +
    "\n\n**Parameters:** " +
    "- `search` (required): Your search query. Be specific and descriptive. " +
    "- `limit` (optional, default 5, max 10): Number of URLs to return. Use 3-5 for deep crawls (depth 2-3), use 8-10 for broad research. " +
    "- `categories` (optional): Filter by topic. Use ['news'] for current events, ['science'] for research papers, ['it'] for tech topics, ['general'] for broad searches. " +
    "- `timeRange` (optional): Filter by recency. Use 'day' or 'week' for breaking news, 'month' for recent developments, 'year' for established information. " +
    "- `language` (optional): Language code (e.g., 'en', 'bg', 'de', 'fr', 'es'). Use when query specifies a language or when searching for region-specific content. " +
    "\n\n**Examples:** " +
    "- Latest news: {search: 'AI regulation updates', categories: ['news'], timeRange: 'week'} " +
    "- Research papers: {search: 'transformer architecture advances', categories: ['science'], limit: 8} " +
    "- Bulgarian content: {search: 'изкуствен интелект новини', language: 'bg'} " +
    "- Tech tutorials: {search: 'React hooks best practices', categories: ['it']}",
  inputSchema: findWebpagesInputSchema,
  needsApproval: false,
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
    const limit = input.limit ?? 5;
    const searxngUrl = config.searxng.url;

    if (!searxngUrl) {
      return { error: "SearXNG URL not configured" };
    }

    try {
      const searchParams = new URLSearchParams();
      searchParams.set("q", search);
      searchParams.set("format", "json");
      searchParams.set("categories", input.categories?.join(",") ?? "general");
      searchParams.set("language", input.language ?? "en");
      searchParams.set("pageno", "1");

      if (input.timeRange) {
        searchParams.set("time_range", input.timeRange);
      }

      const fullUrl = `${searxngUrl}/search?${searchParams.toString()}`;
      console.log(`[SEARXNG] Search query: ${search}`);
      console.log(`[SEARXNG] Search URL: ${fullUrl}`);
      checkpoint("Starting SearXNG search");

      const searchController = new AbortController();
      const searchTimeoutId = setTimeout(
        () => searchController.abort(),
        15 * 1000
      );

      const searchResponse = await fetch(fullUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "AI-Center-Bot/1.0",
        },
        signal: searchController.signal,
      });

      clearTimeout(searchTimeoutId);

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchResult: SearXNGSearchResponse = await searchResponse.json();
      checkpoint("Search results received");

      const candidateUrls = extractUrls(searchResult.results);
      const rankedUrls = candidateUrls.sort((a, b) => b.score - a.score);

      const selectedUrls = rankedUrls.slice(0, limit).map((u) => ({
        url: u.url,
        title: u.title,
        description: u.description,
        category: u.category,
        publishedDate: u.publishedDate,
        score: u.score,
      }));

      checkpoint(`URLs extracted: ${selectedUrls.length} selected`);

      console.log(
        `[SEARXNG] Found ${selectedUrls.length} external links (limit=${limit})`
      );

      if (selectedUrls.length === 0) {
        return { urls: [], error: "No external links found" };
      }

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(3);
      console.log(`[SEARXNG] Search took: ${duration} seconds`);
      checkpoint("COMPLETED");

      return {
        urls: selectedUrls,
        searchQuery: search,
      };
    } catch (error) {
      console.error(`Search failed: ${(error as Error).message}`);
      return {
        urls: [],
        error: `Failed to search: ${(error as Error).message}`,
      };
    }
  },
});

export { extractUrls };
