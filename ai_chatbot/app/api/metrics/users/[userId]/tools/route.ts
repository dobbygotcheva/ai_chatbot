import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserToolCalls } from "@/lib/metrics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);

    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const result = await getUserToolCalls(userId, {
      page,
      pageSize,
      search,
      sortField,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[METRICS USER TOOLS API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tool calls" },
      { status: 500 }
    );
  }
}
