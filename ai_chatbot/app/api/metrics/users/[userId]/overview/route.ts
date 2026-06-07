import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasMetricsAccess } from "@/lib/auth/permission-utils";
import {
  getUserCumulativeMetrics,
  getUserOverviewMetrics,
} from "@/lib/metrics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMetricsAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);

    const metricType = searchParams.get("metricType") || "api-usage";
    const dateRangeParam = searchParams.get("dateRange") || "30d";
    const dateRange = ["7d", "14d", "30d", "all"].includes(dateRangeParam)
      ? (dateRangeParam as "7d" | "14d" | "30d" | "all")
      : "30d";

    if (metricType === "cumulative") {
      const result = await getUserCumulativeMetrics(userId);
      return NextResponse.json(result);
    }

    if (metricType === "api-usage") {
      const result = await getUserOverviewMetrics(userId, { dateRange });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid metric type" }, { status: 400 });
  } catch (error) {
    console.error("[METRICS USER OVERVIEW API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user overview metrics" },
      { status: 500 }
    );
  }
}
