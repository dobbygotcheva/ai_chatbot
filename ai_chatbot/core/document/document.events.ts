// Document Events - Core layer
// Domain events for document-related operations
// Used for event-driven decoupling across domains

import type { DomainEvent } from "../../shared/events/event-bus.port";

export interface DocumentCreatedEvent extends DomainEvent {
  type: "document.created";
  payload: {
    documentId: string;
    userId: string;
    title: string;
    kind: "text" | "code" | "image" | "sheet";
    createdAt: Date;
  };
}

export interface DocumentUpdatedEvent extends DomainEvent {
  type: "document.updated";
  payload: {
    documentId: string;
    userId: string;
    updatedAt: Date;
  };
}

export interface DocumentDeletedEvent extends DomainEvent {
  type: "document.deleted";
  payload: {
    documentId: string;
    userId: string;
    deletedAt: Date;
  };
}

export interface SuggestionCreatedEvent extends DomainEvent {
  type: "document.suggestion.created";
  payload: {
    suggestionId: string;
    documentId: string;
    userId: string;
    createdAt: Date;
  };
}

export interface SuggestionResolvedEvent extends DomainEvent {
  type: "document.suggestion.resolved";
  payload: {
    suggestionId: string;
    documentId: string;
    resolvedAt: Date;
  };
}

export type DocumentEvent =
  | DocumentCreatedEvent
  | DocumentUpdatedEvent
  | DocumentDeletedEvent
  | SuggestionCreatedEvent
  | SuggestionResolvedEvent;
