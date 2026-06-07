import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasMetricsAccess } from "@/lib/auth/permission-utils";
import { getAllUsersMetricsSummary } from "@/lib/metrics";

const TEXT_SORT_FIELDS = new Set(["userEmail"]);
const NUMERIC_SORT_FIELDS = new Set([
  "toolUsage.totalCalls",
  "toolUsage.successfulCalls",
  "tokenUsage.totalTokens",
  "tokenUsage.totalInputTokens",
  "tokenUsage.totalOutputTokens",
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

    // Pagination
    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20", 10);

    // Search
    const search = searchParams.get("search") || "";

    // Sorting
    const rawSortField = searchParams.get("sortField") || "userEmail";
    const sortField = SORTABLE_FIELDS.has(rawSortField)
      ? rawSortField
      : "userEmail";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    // Get all users metrics
    const allUsers = await getAllUsersMetricsSummary();

    // Filter by search
    let filteredUsers = allUsers || [];
    if (search) {
      filteredUsers = filteredUsers.filter((user) =>
        user.userEmail.toLowerCase().includes(search.toLowerCase())
      );
    }

    filteredUsers.sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      switch (sortField) {
        case "userEmail":
          aValue = a.userEmail;
          bValue = b.userEmail;
          break;
        case "toolUsage.totalCalls":
          aValue = a.toolUsage.totalCalls;
          bValue = b.toolUsage.totalCalls;
          break;
        case "toolUsage.successfulCalls": {
          const aRate =
            a.toolUsage.totalCalls > 0
              ? a.toolUsage.successfulCalls / a.toolUsage.totalCalls
              : 0;
          const bRate =
            b.toolUsage.totalCalls > 0
              ? b.toolUsage.successfulCalls / b.toolUsage.totalCalls
              : 0;
          aValue = aRate;
          bValue = bRate;
          break;
        }
        case "tokenUsage.totalTokens":
          aValue = a.tokenUsage.totalTokens;
          bValue = b.tokenUsage.totalTokens;
          break;
        case "tokenUsage.totalInputTokens":
          aValue = a.tokenUsage.totalInputTokens;
          bValue = b.tokenUsage.totalInputTokens;
          break;
        case "tokenUsage.totalOutputTokens":
          aValue = a.tokenUsage.totalOutputTokens;
          bValue = b.tokenUsage.totalOutputTokens;
          break;
        default:
          aValue = a.userEmail;
          bValue = b.userEmail;
      }

      if (TEXT_SORT_FIELDS.has(sortField)) {
        const aText = String(aValue ?? "");
        const bText = String(bValue ?? "");
        return sortOrder === "asc"
          ? aText.localeCompare(bText)
          : bText.localeCompare(aText);
      }

      const aNum = Number(aValue);
      const bNum = Number(bValue);
      return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
    });

    // Paginate
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = filteredUsers
      .slice(startIndex, endIndex)
      .map((user) => ({
        ...user,
        toolUsage: {
          totalCalls: Number(user.toolUsage.totalCalls),
          successfulCalls: Number(user.toolUsage.successfulCalls),
          failedCalls: Number(user.toolUsage.failedCalls),
        },
        tokenUsage: {
          totalTokens: Number(user.tokenUsage.totalTokens),
          totalInputTokens: Number(user.tokenUsage.totalInputTokens),
          totalOutputTokens: Number(user.tokenUsage.totalOutputTokens),
        },
      }));

    return NextResponse.json({
      data: paginatedUsers,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("[METRICS USERS API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
