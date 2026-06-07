// Event Handlers Setup - Infrastructure layer
// Demonstrates how to wire up cross-domain event handlers
// Shows event-driven decoupling in practice

import type { UserDeletedEvent } from "../../core/auth/auth.events";
import type { ChatCreatedEvent } from "../../core/chat/chat.events";
import type { DocumentCreatedEvent } from "../../core/document/document.events";
import type { ConnectionStatusChangedEvent } from "../../core/integration/integration.events";
import type { EventBusPort } from "../../shared/events/event-bus.port";
import type { DrizzleAdapter } from "./drizzle.adapter";

/**
 * SetupCrossDomainEventHandlers - Wires up event-driven decoupling
 *
 * This function demonstrates how different domains react to events
 * from other domains without direct dependencies.
 *
 * Example flow when user is deleted:
 * 1. Auth domain emits 'auth.user.deleted'
 * 2. Chat domain archives all user's chats
 * 3. Document domain marks documents for cleanup
 * 4. Integration domain revokes OAuth tokens
 */
export function setupCrossDomainEventHandlers(
  eventBus: EventBusPort,
  db: DrizzleAdapter
): void {
  // ============================================================================
  // AUTH DOMAIN EVENTS
  // ============================================================================

  // When a user is deleted, archive all their chats
  eventBus.subscribe<UserDeletedEvent>("auth.user.deleted", async (event) => {
    console.log(
      `[Chat Domain] User ${event.payload.userId} deleted, archiving chats...`
    );
    const userChats = await db.chat.findChatsByUserId(event.payload.userId, {
      includeArchived: false,
    });
    const archivePromises = userChats.map((c) => db.chat.archiveChat(c.id));
    await Promise.all(archivePromises);
    console.log(`[Chat Domain] Archived ${userChats.length} chats`);
  });

  // When a user is deleted, clean up their documents
  eventBus.subscribe<UserDeletedEvent>("auth.user.deleted", async (event) => {
    console.log(
      `[Document Domain] User ${event.payload.userId} deleted, cleaning up documents...`
    );
    // In a real scenario, you might:
    // - Transfer ownership to an admin
    // - Mark for deletion after grace period
    // - Export data before deletion
    const userDocs = await db.document.findDocumentsByUserId(
      event.payload.userId
    );
    console.log(
      `[Document Domain] Found ${userDocs.length} documents to clean up`
    );
  });

  // When a user is deleted, revoke all integrations
  eventBus.subscribe<UserDeletedEvent>("auth.user.deleted", async (event) => {
    console.log(
      `[Integration Domain] User ${event.payload.userId} deleted, revoking sessions...`
    );
    const sessions = await db.integration.findSessionsByUserId(
      event.payload.userId
    );
    await Promise.all(
      sessions.map((session) => db.integration.deleteSession(session.id))
    );
    console.log(`[Integration Domain] Revoked ${sessions.length} sessions`);
  });

  // ============================================================================
  // CHAT DOMAIN EVENTS
  // ============================================================================

  // When a chat is created, log for analytics (example)
  eventBus.subscribe<ChatCreatedEvent>("chat.created", (event) => {
    console.log(`[Analytics] Chat created by user ${event.payload.userId}`);
  });

  // ============================================================================
  // DOCUMENT DOMAIN EVENTS
  // ============================================================================

  // When a document is created, notify interested parties
  eventBus.subscribe<DocumentCreatedEvent>("document.created", (event) => {
    console.log(`[Notifications] Document "${event.payload.title}" created`);
  });

  // ============================================================================
  // INTEGRATION DOMAIN EVENTS
  // ============================================================================

  // When connection status changes, log for monitoring
  eventBus.subscribe<ConnectionStatusChangedEvent>(
    "integration.connection.status_changed",
    (event) => {
      console.log(
        `[Monitoring] Connection ${event.payload.connectionId} changed from ${event.payload.oldStatus} to ${event.payload.newStatus}`
      );
    }
  );
}

/**
 * Benefits of this approach:
 *
 * 1. Loose Coupling: Domains don't know about each other directly
 * 2. Single Responsibility: Each handler does one thing
 * 3. Testability: Easy to test handlers in isolation
 * 4. Extensibility: Add new handlers without changing existing code
 * 5. Resilience: If one handler fails, others still run
 *
 * Trade-offs:
 * - Eventual consistency (not immediate)
 * - Need to handle duplicate events (idempotency)
 * - Debugging can be harder (distributed logic)
 */
