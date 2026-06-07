import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lte,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/shared/config";
import { tokenUsage, toolUsage, user as userTable } from "../db/schema";

let _dbInstance: ReturnType<typeof drizzle> | null = null;

function db() {
  if (!_dbInstance) {
    const client = postgres(config.database.url as never);
    _dbInstance = drizzle(client);
  }
  return _dbInstance;
}

export async function trackToolUsage(data: {
  userId: string;
  toolName: string;
  toolType: "base" | "mcp";
  chatId?: string;
  messageId?: string;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}) {
  try {
    await db()
      .insert(toolUsage)
      .values({
        userId: data.userId,
        toolName: data.toolName,
        toolType: data.toolType,
        chatId: data.chatId,
        messageId: data.messageId,
        success: data.success,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        createdAt: new Date(),
      } as typeof toolUsage.$inferInsert);
  } catch (error) {
    console.error("[METRICS] Failed to track tool usage:", error);
  }
}

export async function trackTokenUsage(data: {
  userId: string;
  chatId: string;
  messageId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}) {
  try {
    await db()
      .insert(tokenUsage)
      .values({
        userId: data.userId,
        chatId: data.chatId,
        messageId: data.messageId,
        modelId: data.modelId,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        createdAt: new Date(),
      } as typeof tokenUsage.$inferInsert);
  } catch (error) {
    console.error("[METRICS] Failed to track token usage:", error);
  }
}

export async function getToolUsageMetrics(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const { userId, startDate, endDate, limit = 1000 } = options ?? {};

  try {
    const query = db().select().from(toolUsage).$dynamic();

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(toolUsage.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(toolUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(toolUsage.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    query.orderBy(desc(toolUsage.createdAt));
    query.limit(limit);

    return await query;
  } catch (error) {
    console.error("[METRICS] Failed to get tool usage metrics:", error);
    return [];
  }
}

export async function getTokenUsageMetrics(options?: {
  userId?: string;
  chatId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const { userId, chatId, startDate, endDate, limit = 1000 } = options ?? {};

  try {
    const query = db().select().from(tokenUsage).$dynamic();

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(tokenUsage.userId, userId));
    }

    if (chatId) {
      conditions.push(eq(tokenUsage.chatId, chatId));
    }

    if (startDate) {
      conditions.push(gte(tokenUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(tokenUsage.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    query.orderBy(desc(tokenUsage.createdAt));
    query.limit(limit);

    return await query;
  } catch (error) {
    console.error("[METRICS] Failed to get token usage metrics:", error);
    return [];
  }
}

export async function getAggregatedToolUsage(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { userId, startDate, endDate } = options ?? {};

  try {
    const query = db()
      .select({
        toolName: toolUsage.toolName,
        toolType: toolUsage.toolType,
        totalCalls: count(toolUsage.id),
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = false)`,
        avgDurationMs: avg(toolUsage.durationMs),
      })
      .from(toolUsage)
      .groupBy(toolUsage.toolName, toolUsage.toolType)
      .$dynamic();

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(toolUsage.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(toolUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(toolUsage.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query.having(and(...conditions));
    }

    return await query;
  } catch (error) {
    console.error("[METRICS] Failed to get aggregated tool usage:", error);
    return [];
  }
}

export async function getAggregatedTokenUsage(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { userId, startDate, endDate } = options ?? {};

  try {
    const query = db()
      .select({
        modelId: tokenUsage.modelId,
        totalCalls: count(tokenUsage.id),
        totalInputTokens: sum(tokenUsage.inputTokens),
        totalOutputTokens: sum(tokenUsage.outputTokens),
        totalTokens: sum(tokenUsage.totalTokens),
        avgInputTokens: avg(tokenUsage.inputTokens),
        avgOutputTokens: avg(tokenUsage.outputTokens),
      })
      .from(tokenUsage)
      .groupBy(tokenUsage.modelId)
      .$dynamic();

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(tokenUsage.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(tokenUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(tokenUsage.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query.having(and(...conditions));
    }

    return await query;
  } catch (error) {
    console.error("[METRICS] Failed to get aggregated token usage:", error);
    return [];
  }
}

export async function getTokenUsageByDateRange(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { userId, startDate, endDate } = options ?? {};

  try {
    const query = db()
      .select({
        date: tokenUsage.createdAt,
        totalTokens: sum(tokenUsage.totalTokens),
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
      })
      .from(tokenUsage)
      .groupBy(tokenUsage.createdAt)
      .$dynamic();

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(tokenUsage.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(tokenUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(tokenUsage.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query.having(and(...conditions));
    }

    query.orderBy(tokenUsage.createdAt);

    return await query;
  } catch (error) {
    console.error("[METRICS] Failed to get token usage by date range:", error);
    return [];
  }
}

export async function getUserMetricsSummary(options: {
  userId: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { userId, startDate, endDate } = options;

  try {
    const conditions: SQL[] = [eq(toolUsage.userId, userId)];

    if (startDate) {
      conditions.push(gte(toolUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(toolUsage.createdAt, endDate));
    }

    const [toolStats] = await db()
      .select({
        totalCalls: count(toolUsage.id),
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = false)`,
        avgDurationMs: avg(toolUsage.durationMs),
      })
      .from(toolUsage)
      .where(and(...conditions));

    const tokenConditions: SQL[] = [eq(tokenUsage.userId, userId)];

    if (startDate) {
      tokenConditions.push(gte(tokenUsage.createdAt, startDate));
    }

    if (endDate) {
      tokenConditions.push(lte(tokenUsage.createdAt, endDate));
    }

    const [tokenStats] = await db()
      .select({
        totalCalls: count(tokenUsage.id),
        totalInputTokens: sum(tokenUsage.inputTokens),
        totalOutputTokens: sum(tokenUsage.outputTokens),
        totalTokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .where(and(...tokenConditions));

    const [user] = await db()
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId));

    return {
      userId,
      userEmail: user?.email || "Unknown",
      toolUsage: {
        totalCalls: toolStats?.totalCalls ?? 0,
        successfulCalls: toolStats?.successfulCalls ?? 0,
        failedCalls: toolStats?.failedCalls ?? 0,
        avgDurationMs: toolStats?.avgDurationMs
          ? Number.parseFloat(toolStats.avgDurationMs)
          : 0,
      },
      tokenUsage: {
        totalCalls: tokenStats?.totalCalls ?? 0,
        totalInputTokens: tokenStats?.totalInputTokens
          ? Number.parseInt(tokenStats.totalInputTokens, 10)
          : 0,
        totalOutputTokens: tokenStats?.totalOutputTokens
          ? Number.parseInt(tokenStats.totalOutputTokens, 10)
          : 0,
        totalTokens: tokenStats?.totalTokens
          ? Number.parseInt(tokenStats.totalTokens, 10)
          : 0,
      },
    };
  } catch (error) {
    console.error("[METRICS] Failed to get user metrics summary:", error);
    return null;
  }
}

export async function getAllUsersMetricsSummary(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const { startDate, endDate } = options ?? {};

  try {
    const conditions: SQL[] = [];

    if (startDate) {
      conditions.push(gte(toolUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(toolUsage.createdAt, endDate));
    }

    const userToolStats = await db()
      .select({
        userId: toolUsage.userId,
        totalCalls: count(toolUsage.id),
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = false)`,
      })
      .from(toolUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(toolUsage.userId);

    const tokenConditions: SQL[] = [];

    if (startDate) {
      tokenConditions.push(gte(tokenUsage.createdAt, startDate));
    }

    if (endDate) {
      tokenConditions.push(lte(tokenUsage.createdAt, endDate));
    }

    const userTokenStats = await db()
      .select({
        userId: tokenUsage.userId,
        totalTokens: sum(tokenUsage.totalTokens),
        totalInputTokens: sum(tokenUsage.inputTokens),
        totalOutputTokens: sum(tokenUsage.outputTokens),
      })
      .from(tokenUsage)
      .where(tokenConditions.length > 0 ? and(...tokenConditions) : undefined)
      .groupBy(tokenUsage.userId);

    const userIds = Array.from(
      new Set([
        ...userToolStats.map((s) => s.userId),
        ...userTokenStats.map((s) => s.userId),
      ])
    );

    const users = await db()
      .select({
        id: userTable.id,
        email: userTable.email,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds));

    const userMap = new Map(users.map((u) => [u.id, u]));

    return userIds.map((userId) => {
      const toolStat = userToolStats.find((s) => s.userId === userId);
      const tokenStat = userTokenStats.find((s) => s.userId === userId);
      const user = userMap.get(userId);

      return {
        userId,
        userEmail: user?.email || "Unknown",
        toolUsage: {
          totalCalls: toolStat?.totalCalls ?? 0,
          successfulCalls: toolStat?.successfulCalls ?? 0,
          failedCalls: toolStat?.failedCalls ?? 0,
        },
        tokenUsage: {
          totalTokens: tokenStat?.totalTokens
            ? Number.parseInt(tokenStat.totalTokens, 10)
            : 0,
          totalInputTokens: tokenStat?.totalInputTokens
            ? Number.parseInt(tokenStat.totalInputTokens, 10)
            : 0,
          totalOutputTokens: tokenStat?.totalOutputTokens
            ? Number.parseInt(tokenStat.totalOutputTokens, 10)
            : 0,
        },
      };
    });
  } catch (error) {
    console.error("[METRICS] Failed to get all users metrics summary:", error);
    return [];
  }
}

export async function getUserDetailedMetrics(
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    toolPage?: number;
    toolPageSize?: number;
    tokenPage?: number;
    tokenPageSize?: number;
  }
) {
  const {
    startDate,
    endDate,
    toolPage = 1,
    toolPageSize = 20,
    tokenPage = 1,
    tokenPageSize = 20,
  } = options ?? {};

  try {
    // Get tool breakdown
    const toolConditions: SQL[] = [eq(toolUsage.userId, userId)];
    if (startDate) {
      toolConditions.push(gte(toolUsage.createdAt, startDate));
    }
    if (endDate) {
      toolConditions.push(lte(toolUsage.createdAt, endDate));
    }

    const toolBreakdown = await db()
      .select({
        toolName: toolUsage.toolName,
        toolType: toolUsage.toolType,
        totalCalls: count(toolUsage.id),
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = false)`,
        avgDurationMs: avg(toolUsage.durationMs),
      })
      .from(toolUsage)
      .where(and(...toolConditions))
      .groupBy(toolUsage.toolName, toolUsage.toolType)
      .orderBy(desc(count(toolUsage.id)));

    // Get token breakdown by model
    const tokenConditions: SQL[] = [eq(tokenUsage.userId, userId)];
    if (startDate) {
      tokenConditions.push(gte(tokenUsage.createdAt, startDate));
    }
    if (endDate) {
      tokenConditions.push(lte(tokenUsage.createdAt, endDate));
    }

    const tokenBreakdown = await db()
      .select({
        modelId: tokenUsage.modelId,
        totalCalls: count(tokenUsage.id),
        totalInputTokens: sum(tokenUsage.inputTokens),
        totalOutputTokens: sum(tokenUsage.outputTokens),
        totalTokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .where(and(...tokenConditions))
      .groupBy(tokenUsage.modelId);

    // Get recent tool calls with pagination
    const toolOffset = (toolPage - 1) * toolPageSize;
    const recentToolCallsQuery = await db()
      .select({
        id: toolUsage.id,
        toolName: toolUsage.toolName,
        toolType: toolUsage.toolType,
        success: toolUsage.success,
        errorMessage: toolUsage.errorMessage,
        durationMs: toolUsage.durationMs,
        createdAt: toolUsage.createdAt,
      })
      .from(toolUsage)
      .where(eq(toolUsage.userId, userId))
      .orderBy(desc(toolUsage.createdAt))
      .limit(toolPageSize)
      .offset(toolOffset);

    // Get total count for tool calls
    const toolCallsTotal = await db()
      .select({ count: count() })
      .from(toolUsage)
      .where(eq(toolUsage.userId, userId));

    // Get recent token usage with pagination
    const tokenOffset = (tokenPage - 1) * tokenPageSize;
    const recentTokenUsageQuery = await db()
      .select({
        id: tokenUsage.id,
        modelId: tokenUsage.modelId,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        createdAt: tokenUsage.createdAt,
      })
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .orderBy(desc(tokenUsage.createdAt))
      .limit(tokenPageSize)
      .offset(tokenOffset);

    // Get total count for token usage
    const tokenUsageTotal = await db()
      .select({ count: count() })
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId));

    // Get user summary
    const summary = await getUserMetricsSummary({ userId, startDate, endDate });

    return {
      userId,
      userEmail: summary?.userEmail || "Unknown",
      toolUsage: {
        totalCalls: summary?.toolUsage.totalCalls || 0,
        successfulCalls: summary?.toolUsage.successfulCalls || 0,
        failedCalls: summary?.toolUsage.failedCalls || 0,
        avgDurationMs: summary?.toolUsage.avgDurationMs || 0,
      },
      tokenUsage: {
        totalCalls: summary?.tokenUsage.totalCalls || 0,
        totalInputTokens: summary?.tokenUsage.totalInputTokens || 0,
        totalOutputTokens: summary?.tokenUsage.totalOutputTokens || 0,
        totalTokens: summary?.tokenUsage.totalTokens || 0,
      },
      toolBreakdown: toolBreakdown.map((t) => ({
        ...t,
        avgDurationMs: Number(t.avgDurationMs) || 0,
      })),
      tokenBreakdown: tokenBreakdown.map((t) => ({
        ...t,
        totalCalls: Number(t.totalCalls),
        totalInputTokens: Number(t.totalInputTokens || 0),
        totalOutputTokens: Number(t.totalOutputTokens || 0),
        totalTokens: Number(t.totalTokens || 0),
      })),
      recentToolCalls: {
        data: recentToolCallsQuery.map((t) => ({
          ...t,
          durationMs: Number(t.durationMs),
          createdAt: t.createdAt.toISOString(),
        })),
        total: Number(toolCallsTotal[0]?.count || 0),
        page: toolPage,
        pageSize: toolPageSize,
        totalPages: Math.ceil((toolCallsTotal[0]?.count || 0) / toolPageSize),
      },
      recentTokenUsage: {
        data: recentTokenUsageQuery.map((t) => ({
          ...t,
          inputTokens: Number(t.inputTokens),
          outputTokens: Number(t.outputTokens),
          totalTokens: Number(t.totalTokens),
          createdAt: t.createdAt.toISOString(),
        })),
        total: Number(tokenUsageTotal[0]?.count || 0),
        page: tokenPage,
        pageSize: tokenPageSize,
        totalPages: Math.ceil((tokenUsageTotal[0]?.count || 0) / tokenPageSize),
      },
    };
  } catch (error) {
    console.error("[METRICS] Failed to get user detailed metrics:", error);
    return null;
  }
}

export async function getMostUsedTools(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const { userId, startDate, endDate, limit = 10 } = options ?? {};

  try {
    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(toolUsage.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(toolUsage.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(toolUsage.createdAt, endDate));
    }

    return await db()
      .select({
        toolName: toolUsage.toolName,
        toolType: toolUsage.toolType,
        totalCalls: count(toolUsage.id),
        successfulCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        failedCalls: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = false)`,
        avgDurationMs: avg(toolUsage.durationMs),
        successRate: sql<string>`ROUND(COUNT(*) FILTER (WHERE ${toolUsage.success} = true)::numeric / COUNT(*)::numeric * 100, 2)`,
      })
      .from(toolUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(toolUsage.toolName, toolUsage.toolType)
      .orderBy(desc(count(toolUsage.id)))
      .limit(limit);
  } catch (error) {
    console.error("[METRICS] Failed to get most used tools:", error);
    return [];
  }
}

export async function getCumulativeMetrics() {
  try {
    const cumulativeData = await db()
      .select({
        date: tokenUsage.createdAt,
        requests: count(tokenUsage.id),
        tokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .groupBy(tokenUsage.createdAt)
      .orderBy(tokenUsage.createdAt);

    let runningRequests = 0;
    let runningTokens = 0;

    const result = cumulativeData.map((row) => {
      runningRequests += Number(row.requests);
      runningTokens += Number(row.tokens || 0);
      return {
        date: new Date(row.date).toISOString().split("T")[0],
        cumulativeRequests: runningRequests,
        cumulativeTokens: runningTokens,
      };
    });

    return { data: result };
  } catch (error) {
    console.error("[METRICS] Failed to get cumulative metrics:", error);
    return { data: [] };
  }
}

export async function getOverviewMetrics(options?: {
  dateRange?: "7d" | "14d" | "30d" | "all";
}) {
  const { dateRange = "30d" } = options ?? {};

  try {
    const now = new Date();
    let startDate: Date | undefined;

    if (dateRange !== "all") {
      const days = Number.parseInt(dateRange.replace("d", ""), 10);
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const conditions: SQL[] = [];
    if (startDate) {
      conditions.push(gte(tokenUsage.createdAt, startDate));
    }

    const dailyData = await db()
      .select({
        date: sql<Date>`DATE(${tokenUsage.createdAt})`,
        requests: count(tokenUsage.id),
        tokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`DATE(${tokenUsage.createdAt})`)
      .orderBy(sql`DATE(${tokenUsage.createdAt})`);

    const result = dailyData.map((row) => ({
      date: new Date(row.date).toISOString().split("T")[0],
      requests: Number(row.requests),
      tokens: Number(row.tokens || 0),
    }));

    const totalRequests = result.reduce((sum, d) => sum + d.requests, 0);
    const totalTokens = result.reduce((sum, d) => sum + d.tokens, 0);

    return {
      data: result,
      summary: {
        totalRequests,
        totalTokens,
        avgTokensPerRequest:
          totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
        dateRange,
      },
    };
  } catch (error) {
    console.error("[METRICS] Failed to get overview metrics:", error);
    return {
      data: [],
      summary: {
        totalRequests: 0,
        totalTokens: 0,
        avgTokensPerRequest: 0,
        dateRange,
      },
    };
  }
}

export async function getOverviewSummary() {
  try {
    const [
      totalRequestsResult,
      totalTokensResult,
      totalUsersResult,
      toolStatsResult,
    ] = await Promise.all([
      db().select({ count: count() }).from(tokenUsage),
      db()
        .select({ total: sum(tokenUsage.totalTokens) })
        .from(tokenUsage),
      db()
        .select({ count: countDistinct(tokenUsage.userId) })
        .from(tokenUsage),
      db()
        .select({
          total: count(toolUsage.id),
          success: sql<number>`COUNT(*) FILTER (WHERE ${toolUsage.success} = true)`,
        })
        .from(toolUsage),
    ]);

    const totalRequests = Number(totalRequestsResult[0]?.count || 0);
    const totalTokens = Number(totalTokensResult[0]?.total || 0);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);
    const toolTotal = Number(toolStatsResult[0]?.total || 0);
    const toolSuccess = Number(toolStatsResult[0]?.success || 0);
    const successRate =
      toolTotal > 0 ? Math.round((toolSuccess / toolTotal) * 100) : 0;

    return {
      totalRequests,
      totalTokens,
      totalUsers,
      successRate,
    };
  } catch (error) {
    console.error("[METRICS] Failed to get overview summary:", error);
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalUsers: 0,
      successRate: 0,
    };
  }
}

const USER_TOOL_SORT_COLUMNS = {
  toolName: toolUsage.toolName,
  toolType: toolUsage.toolType,
  success: toolUsage.success,
  durationMs: toolUsage.durationMs,
  createdAt: toolUsage.createdAt,
} as const;

export async function getUserToolCalls(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortField?: string;
    sortOrder?: "asc" | "desc";
  }
) {
  const {
    page = 1,
    pageSize = 20,
    search = "",
    sortField = "createdAt",
    sortOrder = "desc",
  } = options ?? {};

  try {
    const conditions = [eq(toolUsage.userId, userId)];
    if (search) {
      conditions.push(sql`${toolUsage.toolName} ILIKE ${`%${search}%`}`);
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db()
      .select({ count: count() })
      .from(toolUsage)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);
    const offset = (page - 1) * pageSize;

    const sortColumn =
      USER_TOOL_SORT_COLUMNS[
        sortField as keyof typeof USER_TOOL_SORT_COLUMNS
      ] ?? toolUsage.createdAt;
    const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const data = await db()
      .select({
        id: toolUsage.id,
        toolName: toolUsage.toolName,
        toolType: toolUsage.toolType,
        success: toolUsage.success,
        errorMessage: toolUsage.errorMessage,
        durationMs: toolUsage.durationMs,
        createdAt: toolUsage.createdAt,
      })
      .from(toolUsage)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map((d) => ({
        ...d,
        durationMs: Number(d.durationMs),
        createdAt: d.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("[METRICS] Failed to get user tool calls:", error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

const USER_TOKEN_SORT_COLUMNS = {
  modelId: tokenUsage.modelId,
  inputTokens: tokenUsage.inputTokens,
  outputTokens: tokenUsage.outputTokens,
  totalTokens: tokenUsage.totalTokens,
  createdAt: tokenUsage.createdAt,
} as const;

export async function getUserTokenUsage(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortField?: string;
    sortOrder?: "asc" | "desc";
  }
) {
  const {
    page = 1,
    pageSize = 20,
    search = "",
    sortField = "createdAt",
    sortOrder = "desc",
  } = options ?? {};

  try {
    const conditions = [eq(tokenUsage.userId, userId)];
    if (search) {
      conditions.push(sql`${tokenUsage.modelId} ILIKE ${`%${search}%`}`);
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db()
      .select({ count: count() })
      .from(tokenUsage)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);
    const offset = (page - 1) * pageSize;

    const sortColumn =
      USER_TOKEN_SORT_COLUMNS[
        sortField as keyof typeof USER_TOKEN_SORT_COLUMNS
      ] ?? tokenUsage.createdAt;
    const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const data = await db()
      .select({
        id: tokenUsage.id,
        modelId: tokenUsage.modelId,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        createdAt: tokenUsage.createdAt,
      })
      .from(tokenUsage)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      data: data.map((d) => ({
        ...d,
        inputTokens: Number(d.inputTokens),
        outputTokens: Number(d.outputTokens),
        totalTokens: Number(d.totalTokens),
        createdAt: d.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("[METRICS] Failed to get user token usage:", error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

export async function getUserCumulativeMetrics(userId: string) {
  try {
    const cumulativeData = await db()
      .select({
        date: tokenUsage.createdAt,
        requests: count(tokenUsage.id),
        tokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .groupBy(tokenUsage.createdAt)
      .orderBy(tokenUsage.createdAt);

    let runningRequests = 0;
    let runningTokens = 0;

    const result = cumulativeData.map((row) => {
      runningRequests += Number(row.requests);
      runningTokens += Number(row.tokens || 0);
      return {
        date: new Date(row.date).toISOString().split("T")[0],
        cumulativeRequests: runningRequests,
        cumulativeTokens: runningTokens,
      };
    });

    return { data: result };
  } catch (error) {
    console.error("[METRICS] Failed to get user cumulative metrics:", error);
    return { data: [] };
  }
}

export async function getUserOverviewMetrics(
  userId: string,
  options?: { dateRange?: "7d" | "14d" | "30d" | "all" }
) {
  const { dateRange = "30d" } = options ?? {};

  try {
    const now = new Date();
    let startDate: Date | undefined;

    if (dateRange !== "all") {
      const days = Number.parseInt(dateRange.replace("d", ""), 10);
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const conditions: SQL[] = [eq(tokenUsage.userId, userId)];
    if (startDate) {
      conditions.push(gte(tokenUsage.createdAt, startDate));
    }

    const dailyData = await db()
      .select({
        date: sql<Date>`DATE(${tokenUsage.createdAt})`,
        requests: count(tokenUsage.id),
        tokens: sum(tokenUsage.totalTokens),
      })
      .from(tokenUsage)
      .where(and(...conditions))
      .groupBy(sql`DATE(${tokenUsage.createdAt})`)
      .orderBy(sql`DATE(${tokenUsage.createdAt})`);

    const result = dailyData.map((row) => ({
      date: new Date(row.date).toISOString().split("T")[0],
      requests: Number(row.requests),
      tokens: Number(row.tokens || 0),
    }));

    const totalRequests = result.reduce((sum, d) => sum + d.requests, 0);
    const totalTokens = result.reduce((sum, d) => sum + d.tokens, 0);

    return {
      data: result,
      summary: {
        totalRequests,
        totalTokens,
        avgTokensPerRequest:
          totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
        dateRange,
      },
    };
  } catch (error) {
    console.error("[METRICS] Failed to get user overview metrics:", error);
    return {
      data: [],
      summary: {
        totalRequests: 0,
        totalTokens: 0,
        avgTokensPerRequest: 0,
        dateRange,
      },
    };
  }
}
