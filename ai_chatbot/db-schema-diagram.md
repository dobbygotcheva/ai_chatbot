# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   USER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│     email: varchar(64) NOT NULL                                             │
│     password: varchar(64)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   CHAT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│     createdAt: timestamp NOT NULL                                           │
│     title: text NOT NULL                                                    │
│ FK  userId: uuid → User.id                                                  │
│     visibility: varchar ["public", "private"] default "private"             │
│     archivedAt: timestamp (soft-delete)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                MESSAGE_V2                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│ FK  chatId: uuid → Chat.id                                                  │
│     role: varchar NOT NULL                                                  │
│     parts: json NOT NULL                                                    │
│     attachments: json NOT NULL                                              │
│     createdAt: timestamp NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 VOTE_V2                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  chatId: uuid → Chat.id                                                  │
│ PK  messageId: uuid → Message_v2.id                                         │
│     isUpvoted: boolean NOT NULL                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                 STREAM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│ FK  chatId: uuid → Chat.id                                                  │
│     createdAt: timestamp NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                DOCUMENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│ PK  createdAt: timestamp NOT NULL                                           │
│     title: text NOT NULL                                                    │
│     content: text                                                           │
│     kind: varchar ["text", "code", "image", "sheet"] default "text"         │
│ FK  userId: uuid → User.id                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               SUGGESTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│     documentId: uuid → Document.id                                          │
│     documentCreatedAt: timestamp → Document.createdAt                       │
│     originalText: text NOT NULL                                             │
│     suggestedText: text NOT NULL                                            │
│     description: text                                                       │
│     isResolved: boolean NOT NULL default false                              │
│ FK  userId: uuid → User.id                                                  │
│     createdAt: timestamp NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                               MCPSESSION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│ FK  userId: uuid → User.id                                                  │
│     sessionId: text NOT NULL                                                │
│     accessToken: text                                                       │
│     jiraToken: text                                                         │
│     confluenceToken: text                                                   │
│     serverUrl: text NOT NULL                                                │
│     serverName: text NOT NULL default "atlassian"                           │
│     createdAt: timestamp NOT NULL                                           │
│     lastUsedAt: timestamp                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                              LEGEND
═══════════════════════════════════════════════════════════════════════════════

PK = Primary Key
FK = Foreign Key
1:N = One-to-Many relationship

═══════════════════════════════════════════════════════════════════════════════
                         DEPRECATED TABLES
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                MESSAGE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id: uuid (defaultRandom())                                              │
│ FK  chatId: uuid → Chat.id                                                  │
│     role: varchar NOT NULL                                                  │
│     content: json NOT NULL                                                  │
│     createdAt: timestamp NOT NULL                                           │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  VOTE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  chatId: uuid → Chat.id                                                  │
│ PK  messageId: uuid → Message.id                                            │
│     isUpvoted: boolean NOT NULL                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Relationship Overview

```
┌──────────┐       ┌──────────┐       ┌─────────────┐
│   User   │◄──────┤   Chat   │◄──────┤  Message_v2 │
└────┬─────┘  1:N  └────┬─────┘  1:N  └──────┬──────┘
     │                  │                      │
     │ 1:N              │ 1:N                  │ 1:N
     ▼                  ▼                      ▼
┌──────────┐       ┌──────────┐         ┌───────────┐
│ Document │       │  Stream  │         │  Vote_v2  │
└────┬─────┘       └──────────┘         └───────────┘
     │
     │ 1:N
     ▼
┌──────────┐
│Suggestion│
└──────────┘

┌───────────────┐
│  McpSession   │
└───────────────┘
```
