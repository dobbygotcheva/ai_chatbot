import type { Tool } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlPages, crawlPagesInputSchema } from "@/lib/ai/tools/crawl-pages";

vi.mock("@/lib/qdrant/rag", () => ({
  ensureCollection: vi.fn().mockResolvedValue(undefined),
  ingestPage: vi.fn().mockResolvedValue(undefined),
  retrieveRelevant: vi.fn(),
}));

vi.mock("@/shared/config", () => ({
  config: {
    crawler: {
      url: "https://crawl.example.com",
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface CrawlPagesResult {
  markdown?: string;
  urlContents?: Array<{
    url: string;
    content: string;
  }>;
  totalCrawled?: number;
  error?: string;
}

const crawlTool = crawlPages as Tool & {
  execute: (input: {
    urls: string[];
    depth?: number;
    searchQuery: string;
  }) => Promise<CrawlPagesResult>;
};

/**
 * Creates a mock crawl response with the given content
 */
function mockCrawlResponse(options: {
  markdown?: string | { fit_markdown?: string; raw_markdown?: string };
  url?: string;
  extractedContent?: string;
}) {
  const {
    markdown = { fit_markdown: "Article content" },
    url = "https://example.com",
    extractedContent = "",
  } = options;

  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [{ markdown, extracted_content: extractedContent, url }],
  });
}

/**
 * Sets up RAG mock to return empty results
 */
async function mockRagEmpty() {
  const { retrieveRelevant } = await import("@/lib/qdrant/rag");
  vi.mocked(retrieveRelevant).mockResolvedValue([]);
}

describe("crawlPages tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("input validation", () => {
    describe("when input is valid", () => {
      it.each([
        [
          "single URL",
          { urls: ["https://example.com"], searchQuery: "test query" },
        ],
        [
          "multiple URLs",
          {
            urls: ["https://example.com/1", "https://example.com/2"],
            searchQuery: "test query",
          },
        ],
        [
          "with depth=0",
          { urls: ["https://example.com"], depth: 0, searchQuery: "test" },
        ],
        [
          "with depth=1",
          { urls: ["https://example.com"], depth: 1, searchQuery: "test" },
        ],
        [
          "with depth=3",
          { urls: ["https://example.com"], depth: 3, searchQuery: "test" },
        ],
      ])("should accept %s", (_, input) => {
        const result = crawlPagesInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe("when input is invalid", () => {
      it.each([
        [
          "invalid URL format",
          { urls: ["not-a-valid-url"], searchQuery: "test" },
        ],
        [
          "depth below minimum",
          { urls: ["https://example.com"], depth: -1, searchQuery: "test" },
        ],
        [
          "depth above maximum",
          { urls: ["https://example.com"], depth: 4, searchQuery: "test" },
        ],
        ["missing searchQuery", { urls: ["https://example.com"] }],
      ])("should reject %s", (_, input) => {
        const result = crawlPagesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it("should reject empty URLs array at runtime", async () => {
        const result = await crawlTool.execute({
          urls: [],
          searchQuery: "test",
        });
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("error handling", () => {
    it("should return error when URLs array is empty", async () => {
      const result = await crawlTool.execute({ searchQuery: "test", urls: [] });
      expect(result.error).toBeDefined();
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain("Crawling completed");
    });

    it("should handle HTTP errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain("Crawling completed");
    });

    it("should handle malformed JSON gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      });

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
    });
  });

  describe("successful execution", () => {
    it("should return markdown content", async () => {
      mockCrawlResponse({ markdown: { fit_markdown: "Article content" } });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toContain("Article content");
    });

    it("should return urlContents with URL and content", async () => {
      mockCrawlResponse({
        markdown: { fit_markdown: "Content" },
        url: "https://example.com",
      });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.urlContents).toHaveLength(1);
      expect(result.urlContents?.[0]).toEqual({
        url: "https://example.com",
        content: expect.any(String),
      });
    });

    it("should return totalCrawled count", async () => {
      mockCrawlResponse({});
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.totalCrawled).toBeGreaterThan(0);
    });

    it("should crawl multiple URLs in parallel", async () => {
      mockCrawlResponse({ url: "https://example.com/1" });
      mockCrawlResponse({ url: "https://example.com/2" });
      mockCrawlResponse({ url: "https://example.com/3" });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: [
          "https://example.com/1",
          "https://example.com/2",
          "https://example.com/3",
        ],
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.urlContents).toHaveLength(3);
    });

    it("should include source URLs in markdown output", async () => {
      const testUrl = "https://example.com/article";
      mockCrawlResponse({
        markdown: { fit_markdown: "Article content" },
        url: testUrl,
      });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: [testUrl],
      });

      expect(result.markdown).toContain(testUrl);
    });
  });

  describe("markdown format handling", () => {
    it("should handle string markdown format", async () => {
      mockCrawlResponse({ markdown: "String markdown content" });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
    });

    it("should handle object markdown with fit_markdown", async () => {
      mockCrawlResponse({
        markdown: { fit_markdown: "Fit markdown content" },
      });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toContain("Fit markdown content");
    });

    it("should handle object markdown with raw_markdown", async () => {
      mockCrawlResponse({
        markdown: { raw_markdown: "Raw markdown content" },
      });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
    });

    it("should handle empty content gracefully", async () => {
      mockCrawlResponse({ markdown: "", extractedContent: "" });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
    });

    it("should fallback when RAG retrieval fails", async () => {
      mockCrawlResponse({ markdown: { fit_markdown: "Fallback content" } });

      const { retrieveRelevant } = await import("@/lib/qdrant/rag");
      vi.mocked(retrieveRelevant).mockRejectedValue(new Error("RAG failed"));

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      expect(result.markdown).toBeDefined();
    });
  });

  describe("depth parameter", () => {
    it("should use cache without deep crawl when depth=0 (default)", async () => {
      mockCrawlResponse({});
      await mockRagEmpty();

      await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      const callArgs = mockFetch.mock.calls[0]?.[1];
      expect(callArgs?.body).toBeDefined();
      const body = callArgs?.body ? JSON.parse(callArgs.body as string) : {};

      expect(body.crawler_config?.params?.deep_crawl_strategy).toBeUndefined();
      expect(body.crawler_config.params.cache_mode).toBe("ENABLED");
    });

    it("should configure deep crawl when depth > 0", async () => {
      mockCrawlResponse({});
      await mockRagEmpty();

      await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
        depth: 2,
      });

      const callArgs = mockFetch.mock.calls[0]?.[1];
      expect(callArgs?.body).toBeDefined();
      const body = callArgs?.body ? JSON.parse(callArgs.body as string) : {};

      expect(body.crawler_config?.params?.deep_crawl_strategy).toBeDefined();
      expect(
        body.crawler_config.params.deep_crawl_strategy.params.max_depth
      ).toBe(2);
      expect(
        body.crawler_config.params.deep_crawl_strategy.params.max_pages
      ).toBe(8);
    });

    it("should calculate max_pages based on depth", async () => {
      mockCrawlResponse({});
      await mockRagEmpty();

      await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
        depth: 3,
      });

      const callArgs = mockFetch.mock.calls[0]?.[1];
      const body = callArgs?.body ? JSON.parse(callArgs.body as string) : {};

      // max_pages scales with depth (implementation-specific formula)
      expect(
        body.crawler_config?.params?.deep_crawl_strategy?.params?.max_pages
      ).toBeGreaterThan(8);
    });
  });

  describe("regression tests", () => {
    it("should handle URLs with special characters", async () => {
      mockCrawlResponse({
        url: "https://example.com/search?q=test&page=1",
      });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com/search?q=test&page=1"],
      });

      expect(result.urlContents?.[0]?.url).toContain("?");
    });

    it("should handle very long URLs", async () => {
      const longUrl = `https://example.com/${"a".repeat(200)}/page`;
      mockCrawlResponse({ url: longUrl });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: [longUrl],
      });

      expect(result.urlContents).toBeDefined();
    });

    it("should reject mixed valid and invalid URLs in array", () => {
      // Invalid URLs should be caught by input validation
      const result = crawlPagesInputSchema.safeParse({
        urls: ["https://valid.com", "not-valid"],
      });

      expect(result.success).toBe(false);
    });

    it("should handle duplicate URLs in array", async () => {
      mockCrawlResponse({ url: "https://example.com" });
      mockCrawlResponse({ url: "https://example.com" });
      await mockRagEmpty();

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com", "https://example.com"],
      });

      // Implementation deduplicates URLs internally, so only one crawl should occur
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.urlContents).toHaveLength(1);
    });

    it("should handle timeout scenarios", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100)
          )
      );

      const result = await crawlTool.execute({
        searchQuery: "test",
        urls: ["https://example.com"],
      });

      // Should handle gracefully, not crash
      expect(result.markdown).toBeDefined();
    });
  });
});
