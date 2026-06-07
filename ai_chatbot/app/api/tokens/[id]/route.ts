import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { logAudit, revokeToken } from "@/lib/services/tokens";

function getClientInfo(request: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Token id is required" },
      { status: 400 }
    );
  }

  const { ipAddress, userAgent } = getClientInfo(request);

  try {
    const revoked = await revokeToken({ id, userId });
    if (!revoked) {
      return NextResponse.json(
        { code: "not_found:api", message: "Token not found" },
        { status: 404 }
      );
    }

    await logAudit({
      userId,
      tokenId: id,
      action: "TOKEN_REVOKED",
      success: true,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to revoke token" },
      { status: 500 }
    );
  }
}
