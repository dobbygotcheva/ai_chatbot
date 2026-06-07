/**
 * E2E tests for metrics API endpoints
 *
 * These tests verify that the metrics API endpoints correctly
 * interact with the database and return proper paginated responses.
 */

import { expect, test } from "@playwright/test";

test.describe("Metrics API E2E Tests", () => {
  test("GET /api/metrics/tools returns paginated tool usage data", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/tools?page=1&pageSize=10");

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("pageSize");
    expect(data).toHaveProperty("totalPages");
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("GET /api/metrics/tools supports search filtering", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/metrics/tools?page=1&pageSize=10&search=getWeather"
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(
      data.data.every((tool: any) =>
        tool.toolName.toLowerCase().includes("getweather")
      )
    ).toBe(true);
  });

  test("GET /api/metrics/tools handles pagination correctly", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/tools?page=1&pageSize=2");

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.data.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
  });

  test("GET /api/metrics/tokens returns paginated token usage data", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/metrics/tokens?page=1&pageSize=10"
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("pageSize");
    expect(data).toHaveProperty("totalPages");
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("GET /api/metrics/tokens returns individual API call records", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/metrics/tokens?page=1&pageSize=10"
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.data.length > 0) {
      const record = data.data[0];
      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("userId");
      expect(record).toHaveProperty("chatId");
      expect(record).toHaveProperty("modelId");
      expect(record).toHaveProperty("inputTokens");
      expect(record).toHaveProperty("outputTokens");
      expect(record).toHaveProperty("totalTokens");
      expect(record).toHaveProperty("createdAt");
    }
  });

  test("GET /api/metrics/tokens supports search filtering by model", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/metrics/tokens?page=1&pageSize=10&search=foundation"
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(
      data.data.every((token: any) =>
        token.modelId.toLowerCase().includes("foundation")
      )
    ).toBe(true);
  });

  test("GET /api/metrics/tokens handles pagination correctly", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/tokens?page=1&pageSize=2");

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.data.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
  });

  test("GET /api/metrics/users returns paginated user metrics data", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/users?page=1&pageSize=10");

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("pageSize");
    expect(data).toHaveProperty("totalPages");
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("GET /api/metrics/users returns user metrics with tool and token usage", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/users?page=1&pageSize=10");

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.data.length > 0) {
      const userRecord = data.data[0];
      expect(userRecord).toHaveProperty("userId");
      expect(userRecord).toHaveProperty("userEmail");
      expect(userRecord).toHaveProperty("toolUsage");
      expect(userRecord).toHaveProperty("tokenUsage");

      expect(userRecord.toolUsage).toHaveProperty("totalCalls");
      expect(userRecord.toolUsage).toHaveProperty("successfulCalls");
      expect(userRecord.toolUsage).toHaveProperty("failedCalls");

      expect(userRecord.tokenUsage).toHaveProperty("totalTokens");
      expect(userRecord.tokenUsage).toHaveProperty("totalInputTokens");
      expect(userRecord.tokenUsage).toHaveProperty("totalOutputTokens");
    }
  });

  test("GET /api/metrics/users supports search filtering by email", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/metrics/users?page=1&pageSize=10&search=test"
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(
      data.data.every((u: any) => u.userEmail.toLowerCase().includes("test"))
    ).toBe(true);
  });

  test("GET /api/metrics/users handles pagination correctly", async ({
    request,
  }) => {
    const response = await request.get("/api/metrics/users?page=1&pageSize=5");

    expect(response.status()).toBe(200);
    const data = await response.json();

    expect(data.data.length).toBeLessThanOrEqual(5);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(5);
  });
});
