import { tool } from "ai";
import { z } from "zod";

const CRAWL_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_CHARS = 12_000;

export const getWebPageMarkdown = tool({
  description:
    "Fetch a web page and return its contents as markdown. " +
    "Use after createSearchUrl to read search results, then follow 1-2 result links for details. " +
    "Provide the page URL and a short search query to focus the returned content.",
  inputSchema: z.object({
    url: z
      .string()
      .describe(
        "Full URL of the page to fetch (e.g., 'https://example.com/article')"
      ),
    search: z
      .string()
      .describe(
        "Short query to focus content (e.g., 'news today', 'weather', 'price')"
      ),
  }),
  needsApproval: false,
  execute: async (input) => {
    if (!input.url) {
      return { error: "Please provide a URL." };
    }
    if (!input.search) {
      return { error: "Please provide a search query to focus the content." };
    }

    const crawlerUrl = process.env.CRAWLER_URL;
    if (!crawlerUrl) {
      return {
        error:
          "CRAWLER_URL is not configured. Set it in .env.local (e.g. http://localhost:11235/md).",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

    try {
      const response = await fetch(crawlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input.url,
          f: "fit", // content-filter: fit = BM25-ranked relevant snippets
          q: input.search,
          c: "1", // use cache when available for speed
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          error: `Crawler returned ${response.status}: ${responseText.slice(0, 300)}`,
        };
      }

      let markdown: string;
      try {
        const parsed = JSON.parse(responseText);
        markdown = parsed.markdown ?? parsed.content ?? responseText;
      } catch {
        markdown = responseText;
      }

      if (!markdown || markdown.trim().length === 0) {
        return { error: `No readable content found at ${input.url}` };
      }

      // Truncate to keep token usage manageable
      if (markdown.length > MAX_RESPONSE_CHARS) {
        markdown = `${markdown.slice(0, MAX_RESPONSE_CHARS)}\n\n[Content truncated — ${markdown.length} total chars]`;
      }

      return markdown;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return {
          error: `Crawler timed out after ${CRAWL_TIMEOUT_MS / 1000}s fetching ${input.url}`,
        };
      }
      return { error: `Crawler error: ${String(err)}` };
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
