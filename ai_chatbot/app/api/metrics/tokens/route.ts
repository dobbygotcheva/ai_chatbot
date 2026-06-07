import { and, asc, desc, type SQL, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasMetricsAccess } from "@/lib/auth/permission-utils";
import { db } from "@/lib/db";
import { tokenUsage } from "@/lib/db/schema";

const SORT_COLUMN_MAP = {
  modelId: tokenUsage.modelId,
  inputTokens: tokenUsage.inputTokens,
  outputTokens: tokenUsage.outputTokens,
  totalTokens: tokenUsage.totalTokens,
  createdAt: tokenUsage.createdAt,
} as const;

type SortField = keyof typeof SORT_COLUMN_MAP;

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMetricsAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || "";

    const rawSortField = searchParams.get("sortField") || "createdAt";
    const sortField: SortField = (
      Object.hasOwn(SORT_COLUMN_MAP, rawSortField) ? rawSortField : "createdAt"
    ) as SortField;
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const sortColumn = SORT_COLUMN_MAP[sortField];
    const orderBy = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const database = db();

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(sql`${tokenUsage.modelId} ILIKE ${`%${search}%`}`);
    }

    const countResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(tokenUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    const offset = (page - 1) * pageSize;
    const data = await database
      .select()
      .from(tokenUsage)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    const transformedData = data.map((row) => ({
      id: row.id,
      userId: row.userId,
      chatId: row.chatId,
      modelId: row.modelId,
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      totalTokens: Number(row.totalTokens),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data: transformedData,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("[METRICS TOKENS API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
}
