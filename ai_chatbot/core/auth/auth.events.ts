// Auth Events - Core layer
// Domain events for auth-related operations
// Used for event-driven decoupling across domains

import type { DomainEvent } from "../../shared/events/event-bus.port";

export interface UserCreatedEvent extends DomainEvent {
  type: "auth.user.created";
  payload: {
    userId: string;
    email: string;
    createdAt: Date;
  };
}

export interface UserDeletedEvent extends DomainEvent {
  type: "auth.user.deleted";
  payload: {
    userId: string;
    deletedAt: Date;
  };
}

export interface UserUpdatedEvent extends DomainEvent {
  type: "auth.user.updated";
  payload: {
    userId: string;
    email?: string;
    updatedAt: Date;
  };
}

export type AuthEvent = UserCreatedEvent | UserDeletedEvent | UserUpdatedEvent;
