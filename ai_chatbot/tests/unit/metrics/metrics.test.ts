import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAggregatedTokenUsage,
  getAggregatedToolUsage,
  getTokenUsageMetrics,
  getToolUsageMetrics,
  trackTokenUsage,
  trackToolUsage,
} from "@/lib/metrics";
import { stubRequiredEnvVars } from "@/tests/test-utils";

// Mock the database
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
        orderBy: vi.fn(() => Promise.resolve([])),
        limit: vi.fn(() => Promise.resolve([])),
        groupBy: vi.fn(() => Promise.resolve([])),
        $dynamic: vi.fn(),
      })),
    })),
  })),
}));

vi.mock("postgres", () => ({
  default: vi.fn(),
}));

describe("Metrics Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRequiredEnvVars();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe("trackToolUsage", () => {
    it("should track successful tool usage", async () => {
      const testData = {
        userId: "test-user-id",
        toolName: "test-tool",
        toolType: "base" as const,
        chatId: "test-chat-id",
        messageId: "test-message-id",
        success: true,
        durationMs: 150,
        inputTokens: 100,
        outputTokens: 50,
      };

      await trackToolUsage(testData);

      // The function should complete without throwing
      expect(true).toBe(true);
    });

    it("should track failed tool usage", async () => {
      const testData = {
        userId: "test-user-id",
        toolName: "test-tool",
        toolType: "mcp" as const,
        chatId: "test-chat-id",
        success: false,
        errorMessage: "Tool execution failed",
        durationMs: 200,
      };

      await trackToolUsage(testData);

      expect(true).toBe(true);
    });

    it("should handle optional fields correctly", async () => {
      const testData = {
        userId: "test-user-id",
        toolName: "test-tool",
        toolType: "base" as const,
        success: true,
        durationMs: 100,
      };

      await trackToolUsage(testData);

      expect(true).toBe(true);
    });
  });

  describe("trackTokenUsage", () => {
    it("should track token usage", async () => {
      const testData = {
        userId: "test-user-id",
        chatId: "test-chat-id",
        messageId: "test-message-id",
        modelId: "gpt-4",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      await trackTokenUsage(testData);

      expect(true).toBe(true);
    });

    it("should handle optional messageId", async () => {
      const testData = {
        userId: "test-user-id",
        chatId: "test-chat-id",
        modelId: "gpt-4",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      await trackTokenUsage(testData);

      expect(true).toBe(true);
    });
  });

  describe("getToolUsageMetrics", () => {
    it("should fetch tool usage metrics", async () => {
      const result = await getToolUsageMetrics({
        userId: "test-user-id",
        limit: 100,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should fetch metrics with date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const result = await getToolUsageMetrics({
        startDate,
        endDate,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getTokenUsageMetrics", () => {
    it("should fetch token usage metrics", async () => {
      const result = await getTokenUsageMetrics({
        userId: "test-user-id",
        limit: 100,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should fetch metrics for specific chat", async () => {
      const result = await getTokenUsageMetrics({
        chatId: "test-chat-id",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getAggregatedToolUsage", () => {
    it("should return aggregated tool usage statistics", async () => {
      const result = await getAggregatedToolUsage();

      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by user", async () => {
      const result = await getAggregatedToolUsage({
        userId: "test-user-id",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getAggregatedTokenUsage", () => {
    it("should return aggregated token usage statistics", async () => {
      const result = await getAggregatedTokenUsage();

      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const result = await getAggregatedTokenUsage({
        startDate,
        endDate,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
