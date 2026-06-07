import type { Tool } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLOCKED_DOMAINS,
  calculateDomainAuthority,
  tokenizeQuery,
} from "@/lib/ai/tools/constants";
import {
  extractUrls,
  findWebpages,
  findWebpagesInputSchema,
  isValidExternalUrl,
} from "@/lib/ai/tools/find-webpages";

vi.mock("@/shared/config", () => ({
  config: {
    searxng: {
      url: "https://searxng.example.com",
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface FindWebpagesResult {
  urls?: Array<{
    url: string;
    title: string;
    score: number;
  }>;
  searchQuery?: string;
  error?: string;
}

const findTool = findWebpages as Tool & {
  execute: (input: {
    search: string;
    limit?: number;
    categories?: string[];
    timeRange?: "day" | "week" | "month" | "year";
    engines?: string[];
    language?: string;
    safeSearch?: number;
  }) => Promise<FindWebpagesResult>;
};

function mockSearXNGResponse(
  results: Array<{
    title: string;
    url: string;
    content?: string;
    engine?: string;
    category?: string;
  }>
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      query: "test query",
      results,
      suggestions: [],
      answers: [],
    }),
  });
}

const AUTHORITATIVE_DOMAINS = [
  "https://www.bbc.co.uk/sport",
  "https://www.premierleague.com",
  "https://en.wikipedia.org/wiki/Test",
] as const;

describe("findWebpages tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isValidExternalUrl", () => {
    describe("when URL is valid", () => {
      it("should accept HTTPS URLs", () => {
        expect(isValidExternalUrl("https://example.com", "Example")).toBe(true);
      });

      it("should accept HTTP URLs", () => {
        expect(isValidExternalUrl("http://example.com/page", "Page")).toBe(
          true
        );
      });

      it.each(
        AUTHORITATIVE_DOMAINS
      )("should accept authoritative domain: %s", (url) => {
        expect(isValidExternalUrl(url, "Authoritative")).toBe(true);
      });
    });

    describe("when URL is invalid", () => {
      it.each([
        ["FTP protocol", "ftp://example.com"],
        ["JavaScript protocol", "javascript:void(0)"],
        ["Mailto protocol", "mailto:test@example.com"],
      ])("should reject %s: %s", (_, url) => {
        expect(isValidExternalUrl(url, "Test")).toBe(false);
      });
    });

    describe("when domain is blocked", () => {
      it.each(
        BLOCKED_DOMAINS
      )("should block social media domain: %s", (domain) => {
        expect(isValidExternalUrl(`https://${domain}/page`, "Social")).toBe(
          false
        );
      });
    });

    describe("when URL contains blocked patterns", () => {
      it.each([
        "/login",
        "/signup",
        "/register",
        "/account",
        "about:",
        "javascript:",
      ])("should block utility pattern: %s", (pattern) => {
        expect(
          isValidExternalUrl(`https://example.com${pattern}`, "Test")
        ).toBe(false);
      });
    });
  });

  describe("calculateDomainAuthority", () => {
    describe("domain authority scoring", () => {
      it("should boost government domains", () => {
        const score = calculateDomainAuthority("https://www.gov.uk/sport");
        expect(score).toBe(5);
      });

      it("should boost education domains", () => {
        const score = calculateDomainAuthority("https://www.edu/fixtures");
        expect(score).toBe(5);
      });

      it("should boost reference sites", () => {
        const score = calculateDomainAuthority(
          "https://en.wikipedia.org/wiki/Arsenal"
        );
        expect(score).toBe(4);
      });

      it("should boost news sources", () => {
        const score = calculateDomainAuthority("https://www.reuters.com/sport");
        expect(score).toBe(3);
      });
    });
  });

  describe("extractUrls", () => {
    it("should extract URLs from SearXNG results", () => {
      const results = [
        {
          title: "Arsenal Fixtures 2026",
          url: "https://www.premierleague.com/fixtures",
          content: "View all Arsenal matches",
          engine: "google",
          category: "general",
        },
        {
          title: "BBC Sport Arsenal",
          url: "https://www.bbc.co.uk/sport/arsenal",
          content: "Latest Arsenal news",
          engine: "bing",
          category: "news",
        },
      ];

      const urls = extractUrls(results);

      expect(urls.length).toBe(2);
      expect(urls).toEqual([
        {
          url: "https://www.premierleague.com/fixtures",
          title: "Arsenal Fixtures 2026",
          description: "View all Arsenal matches",
          category: "general",
          publishedDate: undefined,
          score: 0,
        },
        {
          url: "https://www.bbc.co.uk/sport/arsenal",
          title: "BBC Sport Arsenal",
          description: "Latest Arsenal news",
          category: "news",
          publishedDate: undefined,
          score: 3,
        },
      ]);
    });

    it("should filter out blocked domains from SearXNG results", () => {
      const results = [
        {
          title: "Premier League",
          url: "https://www.premierleague.com",
        },
        {
          title: "Facebook",
          url: "https://www.facebook.com/arsenal",
        },
        {
          title: "Twitter",
          url: "https://twitter.com/arsenal",
        },
      ];

      const urls = extractUrls(results);

      expect(urls.some((u) => u.url.includes("facebook.com"))).toBe(false);
      expect(urls.some((u) => u.url.includes("twitter.com"))).toBe(false);
      expect(urls.length).toBe(1);
    });

    it("should handle empty results", () => {
      const urls = extractUrls([]);
      expect(urls).toEqual([]);
    });

    it("should filter results without URL or title", () => {
      const results = [
        { title: "No URL", url: "" },
        { title: "", url: "https://example.com" },
        { title: "Valid", url: "https://example.com/valid" },
      ];

      const urls = extractUrls(results as any);

      expect(urls.length).toBe(1);
      expect(urls[0].url).toBe("https://example.com/valid");
    });
  });

  describe("input validation", () => {
    it.each([
      ["valid search query", { search: "test query" }, true],
      ["search with limit", { search: "test", limit: 10 }, true],
      [
        "search with categories",
        { search: "test", categories: ["news", "science"] },
        true,
      ],
      ["search with timeRange", { search: "test", timeRange: "week" }, true],
      ["search with language", { search: "test", language: "de" }, true],
      ["missing search", {}, false],
      ["limit below minimum", { search: "test", limit: 0 }, false],
      ["limit above maximum", { search: "test", limit: 21 }, false],
      ["invalid timeRange", { search: "test", timeRange: "invalid" }, false],
    ])("should %s", (_, input, expectedSuccess) => {
      const result = findWebpagesInputSchema.safeParse(input);
      expect(result.success).toBe(expectedSuccess);
    });
  });

  describe("error handling", () => {
    it("should return error when search query is empty", async () => {
      const result = await findTool.execute({ search: "" });
      expect(result.error).toBeDefined();
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await findTool.execute({ search: "test query" });
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Network error");
    });

    it("should handle HTTP errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
      const result = await findTool.execute({ search: "test query" });
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Search failed: 500");
    });

    it("should handle no results gracefully", async () => {
      mockSearXNGResponse([]);
      const result = await findTool.execute({ search: "test query" });
      expect(result.error).toBe("No external links found");
      expect(result.urls).toEqual([]);
    });

    it("should handle timeout errors", async () => {
      const abortError = new Error("Timeout");
      abortError.name = "AbortError";
      mockFetch.mockImplementationOnce(() => Promise.reject(abortError));

      const result = await findTool.execute({ search: "test query" });
      expect(result.error).toBeDefined();
    });
  });

  describe("successful execution", () => {
    it("should return scored URLs array", async () => {
      mockSearXNGResponse([
        {
          title: "BBC News Breaking Story",
          url: "https://www.bbc.co.uk/news/article",
          content: "Latest news",
          engine: "google",
        },
      ]);

      const result = await findTool.execute({ search: "news" });

      expect(result.urls).toBeDefined();
      expect(Array.isArray(result.urls)).toBe(true);
      expect(result.urls?.length).toBeGreaterThan(0);
    });

    it("should include search query in response", async () => {
      mockSearXNGResponse([
        {
          title: "Example News Article",
          url: "https://example.com/article",
        },
      ]);

      const result = await findTool.execute({ search: "test query" });

      expect(result.searchQuery).toBe("test query");
    });

    it("should respect limit parameter", async () => {
      mockSearXNGResponse([
        { title: "Article 1", url: "https://example.com/1" },
        { title: "Article 2", url: "https://example.com/2" },
        { title: "Article 3", url: "https://example.com/3" },
        { title: "Article 4", url: "https://example.com/4" },
        { title: "Article 5", url: "https://example.com/5" },
      ]);

      const result = await findTool.execute({ search: "test", limit: 3 });

      expect(result.urls?.length).toBeLessThanOrEqual(3);
    });

    it("should return URLs with required properties", async () => {
      mockSearXNGResponse([
        { title: "Example News Article", url: "https://example.com/article" },
      ]);

      const result = await findTool.execute({ search: "example" });

      expect(result.urls?.[0]).toMatchObject({
        url: expect.any(String),
        title: expect.any(String),
        score: expect.any(Number),
      });
    });

    it("should filter blocked domains from final results", async () => {
      mockSearXNGResponse([
        { title: "Good News Article", url: "https://example.com" },
        { title: "Facebook Social Page", url: "https://facebook.com/page" },
      ]);

      const result = await findTool.execute({ search: "test" });

      const hasBlocked = result.urls?.some((u) =>
        u.url.includes("facebook.com")
      );
      expect(hasBlocked).toBe(false);
    });

    it("should use default limit of 5", async () => {
      mockSearXNGResponse([
        { title: "Article 1", url: "https://example.com/1" },
        { title: "Article 2", url: "https://example.com/2" },
        { title: "Article 3", url: "https://example.com/3" },
        { title: "Article 4", url: "https://example.com/4" },
        { title: "Article 5", url: "https://example.com/5" },
        { title: "Article 6", url: "https://example.com/6" },
        { title: "Article 7", url: "https://example.com/7" },
      ]);

      const result = await findTool.execute({ search: "test" });

      expect(result.urls?.length).toBe(5);
    });
  });

  describe("SearXNG configuration parameters", () => {
    it("should pass categories parameter to SearXNG", async () => {
      mockSearXNGResponse([
        { title: "Science Article", url: "https://example.com/science" },
      ]);

      await findTool.execute({
        search: "test",
        categories: ["science", "news"],
      });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("categories=science%2Cnews");
    });

    it("should pass timeRange parameter to SearXNG", async () => {
      mockSearXNGResponse([
        { title: "Recent Article", url: "https://example.com/recent" },
      ]);

      await findTool.execute({
        search: "test",
        timeRange: "week",
      });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("time_range=week");
    });

    it("should pass language parameter to SearXNG", async () => {
      mockSearXNGResponse([
        { title: "German Article", url: "https://example.de/article" },
      ]);

      await findTool.execute({
        search: "test",
        language: "de",
      });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("language=de");
    });

    it("should use default values when parameters are not provided", async () => {
      mockSearXNGResponse([
        { title: "Default Article", url: "https://example.com/default" },
      ]);

      await findTool.execute({ search: "test" });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("categories=general");
      expect(callUrl).toContain("language=en");
    });

    it("should pass all parameters together", async () => {
      mockSearXNGResponse([
        { title: "Custom Article", url: "https://example.com/custom" },
      ]);

      await findTool.execute({
        search: "test",
        categories: ["news"],
        timeRange: "month",
        language: "fr",
      });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain("categories=news");
      expect(callUrl).toContain("time_range=month");
      expect(callUrl).toContain("language=fr");
    });
  });

  describe("regression tests", () => {
    it("should handle special characters in search query", async () => {
      mockSearXNGResponse([
        { title: "Weather Article", url: "https://example.com/weather" },
      ]);

      const result = await findTool.execute({
        search: "What's the weather in NYC?",
      });

      expect(result).toBeDefined();
    });

    it("should handle very long titles", async () => {
      const longTitle = "a".repeat(500);
      mockSearXNGResponse([{ title: longTitle, url: "https://example.com" }]);

      const result = await findTool.execute({ search: "test" });

      expect(result.urls).toBeDefined();
    });

    it("should handle URLs with query parameters", async () => {
      mockSearXNGResponse([
        {
          title: "Search Article",
          url: "https://example.com/search?q=test&page=1",
        },
      ]);

      const result = await findTool.execute({ search: "test" });

      if (result.urls && result.urls.length > 0) {
        expect(result.urls[0].url).toContain("?");
      }
    });

    it("should handle mixed valid and invalid URLs", async () => {
      mockSearXNGResponse([
        { title: "Valid Article", url: "https://example.com" },
        { title: "Invalid Link", url: "javascript:void(0)" },
        { title: "Also Valid", url: "https://bbc.co.uk" },
      ]);

      const result = await findTool.execute({ search: "test" });

      for (const url of result.urls ?? []) {
        expect(url.url).toMatch(/^https?:\/\//);
      }
    });
  });

  describe("tokenizeQuery", () => {
    it("should filter stopwords from query", () => {
      const result = tokenizeQuery("What is the best way to learn TypeScript?");

      expect(result).not.toContain("the");
      expect(result).not.toContain("is");
      expect(result).toContain("learn");
      expect(result).toContain("typescript");
    });

    it("should handle punctuation correctly", () => {
      const result = tokenizeQuery("What's new in 2024?");

      expect(result).toContain("what's");
      expect(result).toContain("new");
      expect(result).toContain("2024");
    });

    it("should filter out short words", () => {
      const result = tokenizeQuery("AI in UK vs USA");

      expect(result).not.toContain("in");
      expect(result).not.toContain("ai");
      expect(result).not.toContain("uk");
      expect(result).toContain("usa");
    });

    it("should handle empty query", () => {
      const result = tokenizeQuery("");

      expect(result).toEqual([]);
    });

    it("should handle query with only stopwords", () => {
      const result = tokenizeQuery("the and or but");

      expect(result).toEqual([]);
    });

    it("should preserve meaningful multi-word concepts", () => {
      const result = tokenizeQuery("New York City weather forecast");

      expect(result).toContain("new");
      expect(result).toContain("york");
      expect(result).toContain("city");
      expect(result).toContain("weather");
      expect(result).toContain("forecast");
    });
  });
});
