// In-Memory Event Bus - Infrastructure implementation
// Simple implementation for single-instance deployments
// Can be swapped for Redis, SQS, etc. for distributed systems

import type {
  DomainEvent,
  EventBusPort,
  EventHandler,
} from "../../shared/events/event-bus.port";

export class InMemoryEventBus implements EventBusPort {
  readonly handlers: Map<string, EventHandler[]> = new Map();

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];

    // Execute all handlers concurrently
    await Promise.all(
      handlers.map((handler) =>
        Promise.resolve(handler(event)).catch((err) => {
          console.error(`Event handler failed for ${event.type}:`, err);
        })
      )
    );
  }

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler as EventHandler]);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(
      eventType,
      existing.filter((h) => h !== handler)
    );
  }
}
