import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { valid: false, reason: "bad_request" },
      { status: 400 }
    );
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json(
      { valid: false, reason: "bad_request" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { valid: false, reason: "unknown" },
    { status: 200 }
  );
}
