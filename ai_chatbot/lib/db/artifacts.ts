import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { type Artifact, artifact } from "./schema";

export interface CreateArtifactInput {
  userId: string;
  chatId: string;
  messageId: string;
  filename: string;
  contentType: string;
  size: number;
  data: string;
  kind: "image" | "file" | "document" | "spreadsheet" | "archive" | "other";
  metadata?: Record<string, unknown>;
}

export async function createArtifact(
  input: CreateArtifactInput
): Promise<Artifact> {
  const result = await db()
    .insert(artifact)
    .values({
      userId: input.userId,
      chatId: input.chatId,
      messageId: input.messageId,
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      data: input.data,
      kind: input.kind,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    })
    .returning();

  return result[0];
}

export async function getArtifactById(
  id: string,
  userId: string
): Promise<Artifact | null> {
  const result = await db()
    .select()
    .from(artifact)
    .where(and(eq(artifact.id, id), eq(artifact.userId, userId)))
    .limit(1);

  return result[0] ?? null;
}

export async function getArtifactsByChatId(
  chatId: string,
  userId: string
): Promise<Artifact[]> {
  const result = await db()
    .select()
    .from(artifact)
    .where(and(eq(artifact.chatId, chatId), eq(artifact.userId, userId)))
    .orderBy(desc(artifact.createdAt));

  return result;
}

export async function getArtifactsByMessageId(
  messageId: string,
  userId: string
): Promise<Artifact[]> {
  const result = await db()
    .select()
    .from(artifact)
    .where(and(eq(artifact.messageId, messageId), eq(artifact.userId, userId)))
    .orderBy(desc(artifact.createdAt));

  return result;
}

export function getArtifactDownloadUrl(artifact: Artifact): string {
  return `data:${artifact.contentType};base64,${artifact.data}`;
}

export async function deleteArtifactById(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db()
    .delete(artifact)
    .where(and(eq(artifact.id, id), eq(artifact.userId, userId)))
    .returning();

  return result.length > 0;
}

export async function deleteArtifactsByChatId(
  chatId: string,
  userId: string
): Promise<number> {
  const result = await db()
    .delete(artifact)
    .where(and(eq(artifact.chatId, chatId), eq(artifact.userId, userId)))
    .returning();

  return result.length;
}
