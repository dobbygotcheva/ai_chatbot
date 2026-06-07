import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  archiveAllChatsByUserId,
  deleteAllChatsByUserId,
  getArchivedChatsByUserId,
  getChatsByUserId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const DEFAULT_HISTORY_LIMIT = 5;
const MAX_HISTORY_LIMIT = 100;

function parseHistoryLimit(raw: string | null): number | null {
  if (raw === null || raw === "") {
    return DEFAULT_HISTORY_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(n, MAX_HISTORY_LIMIT);
}

/**
 * GET /api/history
 * Returns a cursor-paginated list of the user's chats.
 *
 * ?archived=true  → archived chats only  (used by "View archives" dialog)
 * (no flag)       → active chats only    (used by the sidebar SWR feed)
 *
 * We extend the existing history endpoint with the archived flag rather than
 * adding a separate /api/archive route, so the sidebar's SWR infinite-scroll
 * logic (getChatHistoryPaginationKey) stays unchanged.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const limit = parseHistoryLimit(searchParams.get("limit"));
    if (limit === null) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid limit: use a positive integer."
      ).toResponse();
    }

    const startingAfter = searchParams.get("starting_after");
    const endingBefore = searchParams.get("ending_before");
    const archived = searchParams.get("archived") === "true";

    if (startingAfter && endingBefore) {
      return new ChatSDKError(
        "bad_request:api",
        "Only one of starting_after or ending_before can be provided."
      ).toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Only pay for the COUNT(*) on the first page of a fresh pagination run
    // (no cursor on either side). Subsequent cursor-driven pages don't need
    // it: the client caches the total from page 1.
    const includeTotal = !(startingAfter || endingBefore);

    const chats = archived
      ? await getArchivedChatsByUserId({
          id: session.user.id,
          limit,
          startingAfter,
          endingBefore,
          includeTotal,
        })
      : await getChatsByUserId({
          id: session.user.id,
          limit,
          startingAfter,
          endingBefore,
          includeTotal,
        });

    return Response.json(chats);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    throw error;
  }
}

/**
 * DELETE /api/history
 * Hard-deletes every chat for the current user (irreversible).
 * Triggered by "Delete all chats" in Settings → Data Controls and also
 * by the trash icon in the sidebar header.
 */
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const result = await deleteAllChatsByUserId({ userId: session.user.id });

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    throw error;
  }
}

/**
 * PATCH /api/history
 * Soft-archives every active chat for the current user (reversible).
 * Triggered by "Archive all chats" in Settings → Data Controls.
 * Using PATCH (partial update) is semantically correct here because we are
 * updating a field on existing rows, not deleting them.
 */
export async function PATCH() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const result = await archiveAllChatsByUserId({ userId: session.user.id });

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    throw error;
  }
}
