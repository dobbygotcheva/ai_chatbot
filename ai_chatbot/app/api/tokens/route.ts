import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasPermission } from "@/lib/auth/permission-utils";
import { ONE_DAY_MS } from "@/lib/constants";
import {
  checkRateLimit,
  createToken,
  listTokens,
  logAudit,
} from "@/lib/services/tokens";

const RATE_LIMIT_TOKENS_PER_HOUR = 5;
const TOKEN_NAME_MAX_LENGTH = 256;
const DEFAULT_EXPIRES_IN_DAYS = 90;
const MAX_EXPIRES_IN_DAYS = 366 * 5;

function resolveExpiresAt(expiresInDays: number): Date {
  return new Date(Date.now() + expiresInDays * ONE_DAY_MS);
}

function toPublic(token: {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
}) {
  return {
    id: token.id,
    name: token.name,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt.toISOString(),
  };
}

function getClientInfo(request: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokens = await listTokens(session.user.id);
    return NextResponse.json({
      tokens: tokens.map(toPublic),
      publicUrl: null,
    });
  } catch (error) {
    console.error("[tokens] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to list tokens" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { ipAddress, userAgent } = getClientInfo(request);

  if (!hasPermission(session, "llm")) {
    await logAudit({
      userId,
      action: "TOKEN_CREATE_FORBIDDEN",
      success: false,
      errorMessage: "User lacks llm permission",
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: "Forbidden: LLM permission required" },
      { status: 403 }
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const name = typeof body.name === "string" ? body.name.trim() : "API Token";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > TOKEN_NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    const expiresInDays =
      typeof body.expiresInDays === "number"
        ? body.expiresInDays
        : DEFAULT_EXPIRES_IN_DAYS;

    if (
      !Number.isInteger(expiresInDays) ||
      expiresInDays <= 0 ||
      expiresInDays > MAX_EXPIRES_IN_DAYS
    ) {
      return NextResponse.json(
        { error: "Invalid expiration days" },
        { status: 400 }
      );
    }

    if (!(await checkRateLimit(userId))) {
      await logAudit({
        userId,
        action: "TOKEN_CREATE_RATE_LIMITED",
        success: false,
        errorMessage: `Rate limit exceeded: Maximum ${RATE_LIMIT_TOKENS_PER_HOUR} tokens per hour`,
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        {
          error: `Rate limit exceeded: Maximum ${RATE_LIMIT_TOKENS_PER_HOUR} tokens per hour`,
        },
        { status: 429 }
      );
    }

    const created = await createToken({
      userId,
      name,
      expiresAt: resolveExpiresAt(expiresInDays),
    });

    await logAudit({
      userId,
      tokenId: created.id,
      action: "TOKEN_CREATED",
      success: true,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      { ...toPublic({ ...created, lastUsedAt: null }), token: created.token },
      { status: 201 }
    );
  } catch (error) {
    console.error("[tokens] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}
