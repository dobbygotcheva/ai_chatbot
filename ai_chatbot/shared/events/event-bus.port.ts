// Event Bus Port - Shared layer
// Defines event publishing/subscribing capabilities
// Infrastructure implements this (in-memory, Redis, SQS, etc.)

export interface DomainEvent {
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: Date;
  readonly correlationId?: string;
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => Promise<void> | void;

/**
 * Event Bus Port
 * Core publishes events, infrastructure handles delivery
 */
export interface EventBusPort {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}
