import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getAggregatedTokenUsage,
  getAggregatedToolUsage,
  getAllUsersMetricsSummary,
  getTokenUsageByDateRange,
  getTokenUsageMetrics,
  getToolUsageMetrics,
  getUserDetailedMetrics,
  getUserMetricsSummary,
} from "@/lib/metrics";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: API endpoint with multiple route cases
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Number.parseInt(searchParams.get("limit") || "1000", 10);

    // Pagination parameters for detailed user metrics
    const toolPage = Number.parseInt(searchParams.get("toolPage") || "1", 10);
    const toolPageSize = Number.parseInt(
      searchParams.get("toolPageSize") || "20",
      10
    );
    const tokenPage = Number.parseInt(searchParams.get("tokenPage") || "1", 10);
    const tokenPageSize = Number.parseInt(
      searchParams.get("tokenPageSize") || "20",
      10
    );

    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    let response: unknown;

    switch (type) {
      case "tool-usage": {
        response = await getToolUsageMetrics({
          userId: userId || undefined,
          startDate: startDateObj,
          endDate: endDateObj,
          limit,
        });
        break;
      }

      case "token-usage": {
        response = await getTokenUsageMetrics({
          userId: userId || undefined,
          startDate: startDateObj,
          endDate: endDateObj,
          limit,
        });
        break;
      }

      case "aggregated-tools": {
        response = await getAggregatedToolUsage({
          userId: userId || undefined,
          startDate: startDateObj,
          endDate: endDateObj,
        });
        break;
      }

      case "aggregated-tokens": {
        response = await getAggregatedTokenUsage({
          userId: userId || undefined,
          startDate: startDateObj,
          endDate: endDateObj,
        });
        break;
      }

      case "tokens-by-date": {
        response = await getTokenUsageByDateRange({
          userId: userId || undefined,
          startDate: startDateObj,
          endDate: endDateObj,
        });
        break;
      }

      case "user-detailed":
      case "user-summary": {
        if (userId) {
          response = await getUserDetailedMetrics(userId, {
            startDate: startDateObj,
            endDate: endDateObj,
            toolPage,
            toolPageSize,
            tokenPage,
            tokenPageSize,
          });
        } else {
          response = await getAllUsersMetricsSummary({
            startDate: startDateObj,
            endDate: endDateObj,
          });
        }
        break;
      }

      default: {
        const [
          toolUsage,
          tokenUsage,
          aggregatedTools,
          aggregatedTokens,
          allUsersSummary,
        ] = await Promise.all([
          getToolUsageMetrics({
            userId: userId || undefined,
            startDate: startDateObj,
            endDate: endDateObj,
            limit: 100,
          }),
          getTokenUsageMetrics({
            userId: userId || undefined,
            startDate: startDateObj,
            endDate: endDateObj,
            limit: 100,
          }),
          getAggregatedToolUsage({
            userId: userId || undefined,
            startDate: startDateObj,
            endDate: endDateObj,
          }),
          getAggregatedTokenUsage({
            userId: userId || undefined,
            startDate: startDateObj,
            endDate: endDateObj,
          }),
          userId
            ? getUserMetricsSummary({
                userId,
                startDate: startDateObj,
                endDate: endDateObj,
              })
            : getAllUsersMetricsSummary({
                startDate: startDateObj,
                endDate: endDateObj,
              }),
        ]);

        response = {
          toolUsage,
          tokenUsage,
          aggregatedTools,
          aggregatedTokens,
          userSummary: allUsersSummary,
        };
        break;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[METRICS API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
