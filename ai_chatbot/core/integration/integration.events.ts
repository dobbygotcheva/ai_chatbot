// Integration Events - Core layer
// Domain events for integration/MCP-related operations
// Used for event-driven decoupling across domains

import type { DomainEvent } from "../../shared/events/event-bus.port";

export interface ConnectionCreatedEvent extends DomainEvent {
  type: "integration.connection.created";
  payload: {
    connectionId: string;
    userId: string;
    appId: string;
    status: "connected" | "disconnected" | "error";
    connectedAt: Date;
  };
}

export interface ConnectionStatusChangedEvent extends DomainEvent {
  type: "integration.connection.status_changed";
  payload: {
    connectionId: string;
    userId: string;
    appId: string;
    oldStatus: "connected" | "disconnected" | "error";
    newStatus: "connected" | "disconnected" | "error";
    changedAt: Date;
  };
}

export interface ConnectionDeletedEvent extends DomainEvent {
  type: "integration.connection.deleted";
  payload: {
    connectionId: string;
    userId: string;
    appId: string;
    deletedAt: Date;
  };
}

export type IntegrationEvent =
  | ConnectionCreatedEvent
  | ConnectionStatusChangedEvent
  | ConnectionDeletedEvent;
