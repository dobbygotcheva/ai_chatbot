import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasMetricsAccess } from "@/lib/auth/permission-utils";
import { getAggregatedToolUsage } from "@/lib/metrics";

const TEXT_SORT_FIELDS = new Set(["toolName", "toolType"]);
const NUMERIC_SORT_FIELDS = new Set([
  "totalCalls",
  "successfulCalls",
  "failedCalls",
  "avgDurationMs",
]);

const SORTABLE_FIELDS = new Set([...TEXT_SORT_FIELDS, ...NUMERIC_SORT_FIELDS]);

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
    const rawSortField = searchParams.get("sortField") || "totalCalls";
    const sortField = SORTABLE_FIELDS.has(rawSortField)
      ? rawSortField
      : "totalCalls";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const aggregatedTools = await getAggregatedToolUsage();

    let filteredTools = aggregatedTools || [];
    if (search) {
      filteredTools = filteredTools.filter((tool) =>
        tool.toolName.toLowerCase().includes(search.toLowerCase())
      );
    }

    const sortedTools = [...filteredTools].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortField];
      const bValue = (b as Record<string, unknown>)[sortField];

      if (NUMERIC_SORT_FIELDS.has(sortField)) {
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aText = String(aValue ?? "");
      const bText = String(bValue ?? "");
      return sortOrder === "asc"
        ? aText.localeCompare(bText)
        : bText.localeCompare(aText);
    });

    const total = sortedTools.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTools = sortedTools
      .slice(startIndex, endIndex)
      .map((tool) => ({
        ...tool,
        totalCalls: Number(tool.totalCalls),
        successfulCalls: Number(tool.successfulCalls),
        failedCalls: Number(tool.failedCalls),
        avgDurationMs: Number(tool.avgDurationMs),
      }));

    return NextResponse.json({
      data: paginatedTools,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("[METRICS TOOLS API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}
