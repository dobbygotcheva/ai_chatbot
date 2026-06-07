import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(16_000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  /** AI SDK default ids are not always UUIDs (e.g. provider-utils generateId). */
  id: z.string().min(1).max(128),
  role: z.enum(["user"]),
  parts: z.array(partSchema).min(1),
});

// For tool approval flows, we accept all messages (more permissive schema)
const messageSchema = z.object({
  id: z.string(),
  role: z.string(),
  parts: z.array(z.any()),
});

export const postRequestBodySchema = z
  .object({
    id: z.string().uuid(),
    // Either a single new message or all messages (for tool approvals)
    message: userMessageSchema.optional(),
    messages: z.array(messageSchema).optional(),
    selectedChatModel: z.string(),
    selectedVisibilityType: z.enum(["public", "private"]),
    /** Composer toolbar (e.g. deep-search) — steers tools for this turn only */
    composerTools: z.array(z.string()).max(32).optional(),
  })
  .refine(
    (data) => {
      const hasMessages =
        data.messages !== undefined && data.messages.length > 0;
      const hasMessage = data.message !== undefined;
      return hasMessages || hasMessage;
    },
    {
      message: "Either a non-empty messages array or message is required",
      path: ["message"],
    }
  );

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
