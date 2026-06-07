// Auth Event Handlers - Core layer
// Handles cross-domain operations when auth events occur
// Demonstrates event-driven decoupling

import type { EventBusPort } from "../../shared/events/event-bus.port";
import type { UserDeletedEvent } from "./auth.events";

/**
 * SetupAuthEventHandlers - Registers handlers for auth domain events
 *
 * This demonstrates event-driven decoupling:
 * - When a user is deleted, other domains react to the event
 * - No direct foreign key cascade needed
 * - Each domain handles its own cleanup logic
 */
export function setupAuthEventHandlers(
  eventBus: EventBusPort,
  handlers: {
    onUserDeleted?: (event: UserDeletedEvent) => Promise<void>;
  }
): void {
  if (handlers.onUserDeleted) {
    eventBus.subscribe<UserDeletedEvent>(
      "auth.user.deleted",
      handlers.onUserDeleted
    );
  }
}

/**
 * Example: Cross-domain cleanup when user is deleted
 *
 * Other domains (chat, document, integration) subscribe to this event
 * and handle their own cleanup:
 *
 * Chat domain: Archive all user chats
 * Document domain: Transfer ownership or mark documents for deletion
 * Integration domain: Revoke all OAuth tokens
 */
export type UserDeletionHandler = (event: UserDeletedEvent) => Promise<void>;
