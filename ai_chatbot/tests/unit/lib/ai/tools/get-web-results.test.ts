import type { Tool } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWebResults,
  webResultsInputSchema,
} from "@/lib/ai/tools/get-web-results";

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

interface WebResultsResult {
  markdown?: string;
  html?: string;
  error?: string;
}

const webTool = getWebResults as Tool & {
  execute: (input: {
    search: string;
    depth?: number;
  }) => Promise<WebResultsResult>;
};

describe("getWebResults tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("input validation", () => {
    it("should accept valid search query", () => {
      const result = webResultsInputSchema.safeParse({ search: "test query" });
      expect(result.success).toBe(true);
    });

    it("should accept search query with depth", () => {
      const result = webResultsInputSchema.safeParse({
        search: "test query",
        depth: 2,
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing search query", () => {
      const result = webResultsInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should return error when search query is empty", async () => {
      const result = await webTool.execute({ search: "" });

      expect(result).toHaveProperty("error");
    });

    it("should return error when no search results found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await webTool.execute({ search: "test query" });

      expect(result).toHaveProperty("error");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await webTool.execute({ search: "test query" });

      expect(result).toHaveProperty("error");
    });
  });

  describe("successful execution", () => {
    it("should return markdown content", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              markdown: "[News Article](https://example.com/article)",
              html: "",
            },
          ],
        })
        .mockResolvedValue({
          ok: true,
          json: async () => [
            {
              markdown: { fit_markdown: "Article content" },
              extracted_content: "",
            },
          ],
        });

      const { retrieveRelevant } = await import("@/lib/qdrant/rag");
      vi.mocked(retrieveRelevant).mockResolvedValue([]);

      const result = await webTool.execute({ search: "test query" });

      expect(result).toHaveProperty("markdown");
    });

    it("should include source attribution when using RAG", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              markdown: "[News Article](https://example.com/article)",
              html: "",
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              markdown: { fit_markdown: "Article content" },
              extracted_content: "",
            },
          ],
        });

      const { retrieveRelevant } = await import("@/lib/qdrant/rag");
      vi.mocked(retrieveRelevant).mockResolvedValue([
        {
          url: "https://example.com/article",
          chunk: "Relevant content",
          score: 0.95,
        },
      ]);

      const result = await webTool.execute({ search: "test query" });

      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain("https://example.com/article");
    });

    it("should fallback to raw content when retrieval fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              markdown: "[News Article](https://example.com/article)",
              html: "",
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              markdown: { fit_markdown: "Fallback content" },
              extracted_content: "",
            },
          ],
        });

      const { retrieveRelevant } = await import("@/lib/qdrant/rag");
      vi.mocked(retrieveRelevant).mockRejectedValue(
        new Error("Retrieval failed")
      );

      const result = await webTool.execute({ search: "test query" });

      expect(result).toHaveProperty("markdown");
    });
  });
});
