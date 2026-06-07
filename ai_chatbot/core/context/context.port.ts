// Context Port - Core defines what context capabilities it needs
// Context is the ONLY module that accesses vector search (Qdrant)

export interface ContextBundle {
  user: UserContext;
  conversation: ConversationContext;
  relevantDocuments: RelevantDocument[];
  recentMessages: MessageContext[];
  metadata: ContextMetadata;
}

export interface UserContext {
  id: string;
  email: string;
  isGuest: boolean;
  permissions: string[];
}

export interface ConversationContext {
  chatId: string;
  title: string;
  visibility: "public" | "private";
  messageCount: number;
}

export interface RelevantDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  relevanceScore: number;
}

export interface MessageContext {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ContextMetadata {
  timestamp: Date;
  query: string;
  userId: string;
}

export interface BuildContextInput {
  query: string;
  userId: string;
  chatId?: string;
  maxDocuments?: number;
  maxMessages?: number;
}

export interface ContextPort {
  buildContext(input: BuildContextInput): Promise<ContextBundle>;
  hasPermission(user: UserContext, permission: string): boolean;
}
