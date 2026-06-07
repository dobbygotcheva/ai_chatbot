/**
 * GET /api/export
 *
 * Streams a JSON file containing all the authenticated user's chats and
 * messages (including archived ones) as a downloadable attachment.
 *
 * Why a dedicated route instead of reusing /api/history?
 *   - The export intentionally includes archived chats (full data dump).
 *   - It returns messages alongside chats, which the paginated history
 *     endpoint does not.
 *   - The Content-Disposition header triggers a browser file-save dialog,
 *     which is different behaviour from the history JSON feed.
 *
 * The client (settings page) fetches this URL, converts the response to a
 * Blob, creates a temporary object URL, and clicks a hidden <a> tag to
 * trigger the download — the standard browser download pattern for
 * authenticated fetch responses.
 */
import { auth } from "@/app/(auth)/auth";
import { exportUserData } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const data = await exportUserData({ userId: session.user.id });

  // ISO date in filename so the user immediately knows when it was exported
  const filename = `chat-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // "attachment" tells the browser to save rather than display the file
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
