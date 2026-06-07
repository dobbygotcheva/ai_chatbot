import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type Permission = string;

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  name: varchar("name", { length: 64 }),
  azureAdId: varchar("azureAdId", { length: 128 }).unique(),
  picture: text("picture"),
  permissions: json("permissions").$type<Permission[]>().default([]),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // Nullable soft-delete timestamp: NULL means active, a date means archived.
  // We chose a soft-delete (archive) over hard-delete so users can restore
  // conversations later. The timestamp records when it was archived, which
  // is useful for future "auto-purge after 90 days" logic.
  archivedAt: timestamp("archivedAt"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }).onDelete("cascade"),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ─── MCP Session (Runtime Session Management) ─────────────────────────────────
// Stores MCP server session information for runtime communication
// Separate tokens for Jira and Confluence allow granular access control
export const mcpSession = pgTable(
  "McpSession",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    sessionId: text("sessionId").notNull(),
    // Generic access token (for backward compatibility)
    accessToken: text("accessToken"),
    // Atlassian-specific tokens (separate for Jira and Confluence)
    jiraToken: text("jiraToken"),
    confluenceToken: text("confluenceToken"),
    serverUrl: text("serverUrl").notNull(),
    serverName: text("serverName").notNull().default("atlassian"),
    createdAt: timestamp("createdAt").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userRef: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }),
  })
);

export type McpSession = InferSelectModel<typeof mcpSession>;

// ─── Metrics Tracking ─────────────────────────────────────────────────────────
// Tracks tool usage statistics for analytics and monitoring

export const toolUsage = pgTable(
  "ToolUsage",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    toolName: varchar("toolName", { length: 256 }).notNull(),
    toolType: varchar("toolType", { enum: ["base", "mcp"] }).notNull(),
    chatId: uuid("chatId").references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId").references(() => message.id, {
      onDelete: "cascade",
    }),
    success: boolean("success").notNull().default(true),
    errorMessage: text("errorMessage"),
    durationMs: integer("durationMs").notNull(),
    inputTokens: integer("inputTokens"),
    outputTokens: integer("outputTokens"),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userRef: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }),
  })
);

export type ToolUsage = InferSelectModel<typeof toolUsage>;

// Tracks token usage for chat conversations
// chatId is nullable to support proxy server usage tracking without chat context
export const tokenUsage = pgTable(
  "TokenUsage",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId").references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId").references(() => message.id, {
      onDelete: "cascade",
    }),
    modelId: varchar("modelId", { length: 256 }).notNull(),
    inputTokens: integer("inputTokens").notNull(),
    outputTokens: integer("outputTokens").notNull(),
    totalTokens: integer("totalTokens").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userRef: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }),
  })
);

export type TokenUsage = InferSelectModel<typeof tokenUsage>;

// ─── API Token (Authentication & Authorization) ───────────────────────────────
// Stores encrypted API tokens for external access to LLM proxy
export const apiToken = pgTable(
  "ApiToken",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    encryptedToken: text("encryptedToken").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    revokedAt: timestamp("revokedAt"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userRef: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ApiToken_userId_fkey",
    }),
    encryptedTokenIdx: index("ApiToken_encryptedToken_idx").on(
      table.encryptedToken
    ),
    expiresAtIdx: index("ApiToken_expiresAt_idx").on(table.expiresAt),
  })
);

export type ApiToken = InferSelectModel<typeof apiToken>;

// ─── Proxy Audit (Request Logging & Compliance) ──────────────────────────────
// Logs all API requests made through the LLM proxy for auditing
export const proxyAudit = pgTable(
  "ProxyAudit",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenId: uuid("tokenId").references(() => apiToken.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 64 }).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userRef: foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ProxyAudit_userId_fkey",
    }),
    tokenRef: foreignKey({
      columns: [table.tokenId],
      foreignColumns: [apiToken.id],
      name: "ProxyAudit_tokenId_fkey",
    }),
    createdAtIdx: index("ProxyAudit_createdAt_idx").on(table.createdAt),
  })
);

export type ProxyAudit = InferSelectModel<typeof proxyAudit>;

// ─── Artifact (Code Execution Files & Images) ────────────────────────────────
// Stores files and images generated by code execution in PostgreSQL
export const artifact = pgTable(
  "Artifact",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: varchar("contentType", { length: 128 }).notNull(),
    size: integer("size").notNull(), // in bytes
    data: text("data").notNull(), // base64 encoded data
    kind: varchar("kind", {
      enum: ["image", "file", "document", "spreadsheet", "archive", "other"],
    }).notNull(),
    // Optional metadata stored as JSON
    metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    // Index for fast lookups by chat/message
    chatIdx: index("Artifact_chatId_idx").on(table.chatId),
    messageIdx: index("Artifact_messageId_idx").on(table.messageId),
    userIdx: index("Artifact_userId_idx").on(table.userId),
    // Composite index for common query pattern
    chatMessageIdx: index("Artifact_chat_message_idx").on(
      table.chatId,
      table.messageId
    ),
    // Check constraint: size must be between 0 and 5MB
    sizeCheck: check(
      "Artifact_size_check",
      sql`${table.size} >= 0 AND ${table.size} <= 5242880`
    ),
  })
);

export type Artifact = InferSelectModel<typeof artifact>;
