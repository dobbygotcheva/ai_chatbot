import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getArtifactById } from "@/lib/db/artifacts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: artifactId } = await params;

    const artifact = await getArtifactById(artifactId, session.user.id);

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(artifact.data, "base64");
    const url = new URL(request.url);
    const isDownload = url.searchParams.get("download") === "true";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": isDownload
          ? `attachment; filename="${artifact.filename}"`
          : `inline; filename="${artifact.filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
