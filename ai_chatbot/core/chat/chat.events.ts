// Chat Events - Core layer
// Domain events for chat-related operations
// Used for event-driven decoupling across domains

import type { DomainEvent } from "../../shared/events/event-bus.port";

export interface ChatCreatedEvent extends DomainEvent {
  type: "chat.created";
  payload: {
    chatId: string;
    userId: string;
    title: string;
    createdAt: Date;
  };
}

export interface ChatArchivedEvent extends DomainEvent {
  type: "chat.archived";
  payload: {
    chatId: string;
    userId: string;
    archivedAt: Date;
  };
}

export interface ChatDeletedEvent extends DomainEvent {
  type: "chat.deleted";
  payload: {
    chatId: string;
    userId: string;
    deletedAt: Date;
  };
}

export interface MessageCreatedEvent extends DomainEvent {
  type: "chat.message.created";
  payload: {
    messageId: string;
    chatId: string;
    role: string;
    createdAt: Date;
  };
}

export type ChatEvent =
  | ChatCreatedEvent
  | ChatArchivedEvent
  | ChatDeletedEvent
  | MessageCreatedEvent;
