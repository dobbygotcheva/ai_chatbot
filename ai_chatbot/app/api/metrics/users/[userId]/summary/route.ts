import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserMetricsSummary } from "@/lib/metrics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    const result = await getUserMetricsSummary({ userId });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      toolUsage: result.toolUsage,
      tokenUsage: result.tokenUsage,
      successRate:
        result.toolUsage.totalCalls > 0
          ? Math.round(
              (result.toolUsage.successfulCalls / result.toolUsage.totalCalls) *
                100
            )
          : 0,
    });
  } catch (error) {
    console.error("[METRICS USER SUMMARY API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user summary" },
      { status: 500 }
    );
  }
}
