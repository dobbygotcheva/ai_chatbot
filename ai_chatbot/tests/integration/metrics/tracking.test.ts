/**
 * Integration tests for metrics tracking functions
 *
 * These tests verify that tracking functions correctly write to and read from the database.
 * Requires a test database connection.
 *
 * Run with: pnpm test:integration
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { chat, message, tokenUsage, toolUsage, user } from "@/lib/db/schema";
import {
  getAggregatedTokenUsage,
  getAggregatedToolUsage,
  getTokenUsageMetrics,
  getToolUsageMetrics,
  getUserDetailedMetrics,
  getUserMetricsSummary,
  trackTokenUsage,
  trackToolUsage,
} from "@/lib/metrics";

// Test data helpers - generate proper UUIDs for database compatibility
const generateId = () => randomUUID();

describe("Metrics Integration Tests", () => {
  const testUserIds: string[] = [];
  const testChatIds: string[] = [];
  const testMessageIds: string[] = [];

  // Cleanup after all tests
  afterAll(async () => {
    // Delete all test data in reverse order of creation
    // Must delete child records first due to foreign key constraints
    // Delete usage records by messageId (they reference messages)
    for (const id of testMessageIds) {
      await Promise.all([
        db().delete(tokenUsage).where(eq(tokenUsage.messageId, id)),
        db().delete(toolUsage).where(eq(toolUsage.messageId, id)),
      ]);
    }
    // Also delete usage records by chatId (for tests without messageId)
    for (const id of testChatIds) {
      await Promise.all([
        db().delete(tokenUsage).where(eq(tokenUsage.chatId, id)),
        db().delete(toolUsage).where(eq(toolUsage.chatId, id)),
      ]);
    }
    // Now safe to delete messages
    for (const id of testMessageIds) {
      await db().delete(message).where(eq(message.id, id));
    }
    // Then chats
    for (const id of testChatIds) {
      await db().delete(chat).where(eq(chat.id, id));
    }
    // Finally users
    for (const id of testUserIds) {
      await db().delete(user).where(eq(user.id, id));
    }
  });

  describe("trackTokenUsage", () => {
    it("should write token usage to database and verify retrieval", async () => {
      const userId = generateId();
      const chatId = generateId();
      const messageId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);
      testMessageIds.push(messageId);

      // Create test user, chat, and message
      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });
      await db().insert(message).values({
        id: messageId,
        chatId,
        role: "assistant",
        parts: [],
        attachments: [],
        createdAt: new Date(),
      });

      // Track token usage
      const tokenData = {
        userId,
        chatId,
        messageId,
        modelId: "foundation",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      };

      await trackTokenUsage(tokenData);

      // Verify data was written
      const savedUsage = await db()
        .select()
        .from(tokenUsage)
        .where(eq(tokenUsage.messageId, messageId))
        .limit(1);

      expect(savedUsage.length).toBe(1);
      expect(savedUsage[0].userId).toBe(userId);
      expect(savedUsage[0].chatId).toBe(chatId);
      expect(savedUsage[0].modelId).toBe("foundation");
      expect(Number(savedUsage[0].inputTokens)).toBe(1000);
      expect(Number(savedUsage[0].outputTokens)).toBe(500);
      expect(Number(savedUsage[0].totalTokens)).toBe(1500);
    });

    it("should track token usage without messageId", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      const tokenData = {
        userId,
        chatId,
        modelId: "foundation",
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      };

      await trackTokenUsage(tokenData);

      // Verify data was written
      const savedUsage = await db()
        .select()
        .from(tokenUsage)
        .where(eq(tokenUsage.chatId, chatId))
        .limit(1);

      expect(savedUsage.length).toBeGreaterThan(0);
      expect(Number(savedUsage[0].inputTokens)).toBe(2000);
    });
  });

  describe("trackToolUsage", () => {
    it("should write tool usage to database and verify retrieval", async () => {
      const userId = generateId();
      const chatId = generateId();
      const messageId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);
      testMessageIds.push(messageId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });
      await db().insert(message).values({
        id: messageId,
        chatId,
        role: "assistant",
        parts: [],
        attachments: [],
        createdAt: new Date(),
      });

      const toolData = {
        userId,
        toolName: "getWeather",
        toolType: "base" as const,
        chatId,
        messageId,
        success: true,
        durationMs: 250,
        inputTokens: 100,
        outputTokens: 50,
      };

      await trackToolUsage(toolData);

      // Verify data was written
      const savedUsage = await db()
        .select()
        .from(toolUsage)
        .where(eq(toolUsage.messageId, messageId))
        .limit(1);

      expect(savedUsage.length).toBe(1);
      expect(savedUsage[0].userId).toBe(userId);
      expect(savedUsage[0].toolName).toBe("getWeather");
      expect(savedUsage[0].toolType).toBe("base");
      expect(savedUsage[0].success).toBe(true);
      expect(Number(savedUsage[0].durationMs)).toBe(250);
    });

    it("should track failed tool usage with error message", async () => {
      const userId = generateId();
      const chatId = generateId();
      const messageId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);
      testMessageIds.push(messageId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });
      await db().insert(message).values({
        id: messageId,
        chatId,
        role: "assistant",
        parts: [],
        attachments: [],
        createdAt: new Date(),
      });

      const toolData = {
        userId,
        toolName: "findWebpages",
        toolType: "base" as const,
        chatId,
        messageId,
        success: false,
        errorMessage: "API timeout",
        durationMs: 5000,
      };

      await trackToolUsage(toolData);

      // Verify error message was saved
      const savedUsage = await db()
        .select()
        .from(toolUsage)
        .where(eq(toolUsage.messageId, messageId))
        .limit(1);

      expect(savedUsage.length).toBe(1);
      expect(savedUsage[0].success).toBe(false);
      expect(savedUsage[0].errorMessage).toBe("API timeout");
    });
  });

  describe("getTokenUsageMetrics", () => {
    it("should retrieve token usage metrics", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      // Insert multiple token usage records
      await db()
        .insert(tokenUsage)
        .values([
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation",
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation",
            inputTokens: 2000,
            outputTokens: 1000,
            totalTokens: 3000,
            createdAt: new Date(),
          },
        ]);

      const metrics = await getTokenUsageMetrics({ userId, limit: 100 });

      expect(metrics.length).toBeGreaterThan(0);
      const userMetrics = metrics.filter((m) => m.userId === userId);
      expect(userMetrics.length).toBeGreaterThan(0);
    });
  });

  describe("getToolUsageMetrics", () => {
    it("should retrieve tool usage metrics", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      await db()
        .insert(toolUsage)
        .values([
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 200,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "findWebpages",
            toolType: "base",
            chatId,
            success: false,
            errorMessage: "Error",
            durationMs: 1000,
            createdAt: new Date(),
          },
        ]);

      const metrics = await getToolUsageMetrics({ userId, limit: 100 });

      expect(metrics.length).toBeGreaterThan(0);
      const userMetrics = metrics.filter((m) => m.userId === userId);
      expect(userMetrics.length).toBeGreaterThan(0);
    });
  });

  describe("getUserMetricsSummary", () => {
    it("should return aggregated user metrics", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      // Insert token usage
      await db().insert(tokenUsage).values({
        id: generateId(),
        userId,
        chatId,
        modelId: "foundation",
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        createdAt: new Date(),
      });

      // Insert tool usage
      await db()
        .insert(toolUsage)
        .values([
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 200,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 300,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "findWebpages",
            toolType: "base",
            chatId,
            success: false,
            errorMessage: "Error",
            durationMs: 1000,
            createdAt: new Date(),
          },
        ]);

      const summary = await getUserMetricsSummary({ userId });

      expect(summary).not.toBeNull();
      expect(summary?.userEmail).toContain("@example.com");
      expect(Number(summary?.toolUsage.totalCalls)).toBe(3);
      expect(Number(summary?.toolUsage.successfulCalls)).toBe(2);
      expect(Number(summary?.toolUsage.failedCalls)).toBe(1);
      expect(Number(summary?.tokenUsage.totalTokens)).toBe(7500);
      expect(Number(summary?.tokenUsage.totalInputTokens)).toBe(5000);
      expect(Number(summary?.tokenUsage.totalOutputTokens)).toBe(2500);
    });
  });

  describe("getUserDetailedMetrics", () => {
    it("should return detailed user metrics with breakdowns", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      // Insert multiple tool usage records with different tools
      await db()
        .insert(toolUsage)
        .values([
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 200,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 300,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "findWebpages",
            toolType: "base",
            chatId,
            success: false,
            errorMessage: "Error",
            durationMs: 1000,
            createdAt: new Date(),
          },
        ]);

      // Insert multiple token usage records with different models
      await db()
        .insert(tokenUsage)
        .values([
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation",
            inputTokens: 3000,
            outputTokens: 1500,
            totalTokens: 4500,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation-thinking",
            inputTokens: 2000,
            outputTokens: 1000,
            totalTokens: 3000,
            createdAt: new Date(),
          },
        ]);

      const detailed = await getUserDetailedMetrics(userId);

      expect(detailed).not.toBeNull();
      expect(detailed?.userEmail).toContain("@example.com");

      // Check tool breakdown
      expect(detailed?.toolBreakdown.length).toBeGreaterThan(0);
      const weatherTool = detailed?.toolBreakdown.find(
        (t) => t.toolName === "getWeather"
      );
      expect(weatherTool).toBeDefined();
      expect(Number(weatherTool?.totalCalls)).toBe(2);
      expect(Number(weatherTool?.successfulCalls)).toBe(2);

      // Check token breakdown
      expect(detailed?.tokenBreakdown.length).toBeGreaterThan(0);
      const foundationModel = detailed?.tokenBreakdown.find(
        (t) => t.modelId === "foundation"
      );
      expect(foundationModel).toBeDefined();
      expect(Number(foundationModel?.totalTokens)).toBe(4500);

      // Check recent activity
      expect(detailed?.recentToolCalls.data.length).toBeGreaterThan(0);
      expect(detailed?.recentTokenUsage.data.length).toBeGreaterThan(0);
    });
  });

  describe("getAggregatedTokenUsage", () => {
    it("should aggregate token usage by model", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      await db()
        .insert(tokenUsage)
        .values([
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation",
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            chatId,
            modelId: "foundation",
            inputTokens: 2000,
            outputTokens: 1000,
            totalTokens: 3000,
            createdAt: new Date(),
          },
        ]);

      const aggregated = await getAggregatedTokenUsage();

      expect(aggregated.length).toBeGreaterThan(0);
      const foundationAgg = aggregated.find((a) => a.modelId === "foundation");
      expect(foundationAgg).toBeDefined();
      expect(Number(foundationAgg?.totalCalls)).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getAggregatedToolUsage", () => {
    it("should aggregate tool usage by tool name", async () => {
      const userId = generateId();
      const chatId = generateId();
      testUserIds.push(userId);
      testChatIds.push(chatId);

      await db()
        .insert(user)
        .values({
          id: userId,
          email: `test-${userId}@example.com`,
        });
      await db().insert(chat).values({
        id: chatId,
        userId,
        title: "Test Chat",
        createdAt: new Date(),
      });

      await db()
        .insert(toolUsage)
        .values([
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 200,
            createdAt: new Date(),
          },
          {
            id: generateId(),
            userId,
            toolName: "getWeather",
            toolType: "base",
            chatId,
            success: true,
            durationMs: 300,
            createdAt: new Date(),
          },
        ]);

      const aggregated = await getAggregatedToolUsage();

      expect(aggregated.length).toBeGreaterThan(0);
      const weatherAgg = aggregated.find((a) => a.toolName === "getWeather");
      expect(weatherAgg).toBeDefined();
      expect(Number(weatherAgg?.totalCalls)).toBeGreaterThanOrEqual(2);
    });
  });
});
