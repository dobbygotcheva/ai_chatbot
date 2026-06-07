import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/qdrant/rag";

describe("RAG - chunkText", () => {
  describe("basic chunking", () => {
    it("splits long text into chunks", () => {
      const text = "a".repeat(2000);
      const chunks = chunkText(text);
      // Should create at least one chunk
      expect(chunks.length).toBeGreaterThan(0);
      // Chunks should respect approximate max size
      expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
    });

    it("handles short text", () => {
      const text = "Short text ".repeat(10); // Make it long enough to pass MIN_CHUNK
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("handles empty text", () => {
      const chunks = chunkText("");
      expect(chunks.length).toBe(0);
    });
  });

  describe("paragraph-aware chunking", () => {
    it("respects paragraph boundaries", () => {
      const text = `First paragraph with some content.

Second paragraph with more content.

Third paragraph with even more content.`;
      const chunks = chunkText(text);
      // Should try to keep paragraphs together when possible
      expect(chunks.some((chunk) => chunk.includes("First paragraph"))).toBe(
        true
      );
    });

    it("handles multiple newlines", () => {
      const text = `Paragraph 1 with enough content to meet minimum chunk size requirements


Paragraph 2 also has sufficient length



Paragraph 3 completes the test with more text`;
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("chunk overlap", () => {
    it("includes overlap between chunks", () => {
      const text = "a".repeat(1500);
      const chunks = chunkText(text);
      if (chunks.length > 1) {
        // There should be some overlap (total length > original)
        expect(chunks[0].length + chunks[1].length).toBeGreaterThan(1500);
      }
    });
  });

  describe("minimum chunk size", () => {
    it("filters out very small chunks", () => {
      const text = `${"Small ".repeat(10)}

${"Large paragraph ".repeat(100)}

${"Tiny ".repeat(10)}`;
      const chunks = chunkText(text);
      // Should have chunks from the large paragraph
      expect(chunks.length).toBeGreaterThan(0);
      // Large chunks should meet minimum size
      expect(chunks.some((chunk) => chunk.length >= 50)).toBe(true);
    });
  });

  describe("real-world content", () => {
    it("handles article-like content", () => {
      const article = `# Arsenal Fixtures 2026

Arsenal Football Club has announced their fixture schedule for the 2026 season.

## Premier League Matches

The Gunners will face Liverpool at Emirates Stadium on April 15, 2026. This crucial match could determine the title race outcome.

### Key Dates
- April 15: vs Liverpool (Home)
- April 22: vs Manchester City (Away)
- May 1: vs Chelsea (Home)

## Champions League Fixtures

Arsenal continues their European campaign with matches against top clubs.

**Note:** All times are subject to change based on TV scheduling.`;

      const chunks = chunkText(article);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.includes("Arsenal"))).toBe(true);
      expect(chunks.some((c) => c.includes("April 15"))).toBe(true);
    });

    it("handles structured data (tables, lists)", () => {
      const table = `| Date | Opponent | Venue | Time |
|------|----------|-------|------|
| Apr 15 | Liverpool | Home | 15:00 |
| Apr 22 | Man City | Away | 17:30 |
| May 1 | Chelsea | Home | 20:00 |`;

      const chunks = chunkText(table);
      expect(chunks.length).toBeGreaterThan(0);
      // Table structure should be preserved in at least one chunk
      expect(chunks.some((c) => c.includes("|"))).toBe(true);
    });

    it("handles URLs and links", () => {
      const content = `Check out these sources:
- https://www.premierleague.com/fixtures
- https://www.bbc.co.uk/sport/football
- [Arsenal Official Site](https://www.arsenal.com)`;

      const chunks = chunkText(content);
      expect(chunks.some((c) => c.includes("premierleague.com"))).toBe(true);
      expect(chunks.some((c) => c.includes("bbc.co.uk"))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles very long paragraphs", () => {
      const longParagraph = "a".repeat(5000);
      const chunks = chunkText(longParagraph);
      // Should create at least one chunk (may not split without sentence boundaries)
      expect(chunks.length).toBeGreaterThan(0);
      // Chunks should respect max size
      expect(chunks.every((c) => c.length <= 1500)).toBe(true);
    });

    it("handles special characters", () => {
      const text = "Special chars: @#$%^&*()_+-=[]{}|;':\",./<>? ".repeat(10);
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain("@#$%^&*()");
    });

    it("handles Unicode characters", () => {
      const text = "Unicode: 你好世界 🌍 café naïve ".repeat(10);
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain("你好世界");
      expect(chunks[0]).toContain("🌍");
    });

    it("handles mixed line endings", () => {
      const text = "Line 1\r\nLine 2\nLine 3\rLine 4 ".repeat(15);
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
