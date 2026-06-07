# Clean Architecture

Business logic at the center, technical concerns at the edges.

**Dependency Flow**: `core → shared → infrastructure → external libs`

## Directory Structure

```
├── core/                    # Domain layer - pure business logic
│   ├── context/             # Request context assembly
│   │   ├── context.port.ts
│   │   └── context.service.ts
│   ├── chat/                # Chat domain
│   │   ├── chat.entity.ts
│   │   ├── chat.repository.ts
│   │   └── chat.events.ts
│   ├── mcp/                 # MCP integration interface
│   │   └── mcp.port.ts
│   └── ai/                  # AI capabilities interface
│       ├── ai.port.ts
│       └── tool.port.ts
│
├── shared/                  # Shared service ports
│   ├── config/              # Centralized configuration
│   │   └── index.ts         # ONLY place accessing process.env
│   ├── vector/              # Vector search interface
│   │   └── vector.port.ts
│   ├── database/            # Database interface
│   │   └── database.port.ts
│   ├── events/              # Event bus interface
│   │   └── event-bus.port.ts
│   └── ai/                  # AI service interfaces
│       └── tool.port.ts
│
├── infrastructure/          # External implementations
│   ├── qdrant/              # Qdrant vector search
│   │   └── qdrant.adapter.ts
│   ├── database/            # Drizzle ORM
│   │   ├── drizzle.adapter.ts
│   │   └── schema.ts
│   ├── mcp/                 # MCP connectors
│   │   ├── mcp.adapter.ts
│   │   └── connectors/
│   │       └── atlassian.adapter.ts
│   ├── events/              # Event bus implementation
│   │   └── in-memory-event-bus.ts
│   └── ai/                  # AI implementations
│       ├── ai.adapter.ts
│       └── tool-registry.ts
│
└── app/                     # Next.js app (presentation)
    └── (chat)/
        └── api/
            └── example-route.ts
```

## Core Principles

### 1. Ports and Adapters Pattern

**Core/Shared defines interfaces (Ports) → Infrastructure implements them (Adapters)**

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Core** | Business logic, entities, domain events | `ChatEntity`, `ChatCreatedEvent` |
| **Shared** | Service interfaces (ports) | `VectorSearchPort`, `EventBusPort` |
| **Infrastructure** | Implements ports using external libs | `QdrantAdapter`, `InMemoryEventBus` |

### 2. Dependency Rule

Dependencies point inward:
```
App → Core → Shared → Infrastructure → External Libs
```

- **Core** has zero external dependencies
- **Shared** defines interfaces Core needs
- **Infrastructure** implements those interfaces
- **App** wires everything together

### 3. Context Module - High Cohesion

The Context module is the **ONLY** place that builds request context:

```typescript
// core/context/context.service.ts
class ContextService {
  constructor(
    private vectorSearch: VectorSearchPort,  // From shared
    private database: DatabasePort           // From shared
  ) {}

  async buildContext(input: BuildContextInput): Promise<ContextBundle> {
    // 1. Fetch user
    const user = await this.fetchUser(input.userId);
    
    // 2. Fetch relevant documents via vector search
    // This is the ONLY place that triggers vector search
    const documents = await this.fetchRelevantDocuments(input.query);
    
    // 3. Assemble complete context
    return { user, conversation, relevantDocuments, recentMessages, metadata };
  }
}
```

**Key points:**
- Context is the **only** module calling `vectorSearch.search()`
- No other module knows about Qdrant
- Vector search abstracted through `VectorSearchPort`

### 4. Centralized Configuration

**`shared/config/index.ts` is the ONLY file accessing `process.env`**

```typescript
// ❌ Never do this in other files
const dbUrl = process.env.POSTGRES_URL;

// ✅ Always do this
import { config } from '@/shared/config';
const dbUrl = config.database.url;
```

Benefits:
- Single source of truth
- Validation at startup (fails fast)
- Type safety
- No scattered env access

### 5. Event Bus for Decoupled Side Effects

```typescript
// Core publishes events
await eventBus.publish({
  type: 'chat.created',
  payload: { chatId, userId },
  timestamp: new Date()
});

// Application/Infra subscribes
eventBus.subscribe('chat.created', async (event) => {
  // Send notification
  // Update analytics
  // Index for search
});
```

### 6. Tool Registry with Constructor Injection

Dynamic tool composition:

```typescript
// Create registry and register tools
const toolRegistry = new ToolRegistry();
toolRegistry.register(new WeatherTool());
toolRegistry.register(new DocumentTool());

// Inject into AI service
const aiService = new AIService(aiAdapter, toolRegistry);

// MCP tools can be registered dynamically
mcpAdapter.getAppDefinitions().forEach(app => {
  app.tools.forEach(tool => {
    toolRegistry.register(new McpToolAdapter(mcpAdapter, app.id, tool));
  });
});
```

### 7. MCP Connectors Decoupled

```typescript
// Core defines port
core/mcp/mcp.port.ts → McpPort, McpConnectorPort

// Infrastructure implements
infrastructure/mcp/mcp.adapter.ts → McpAdapter
infrastructure/mcp/connectors/atlassian.adapter.ts → AtlassianConnectorAdapter

// Existing connector wrapped, not modified
lib/mcp/connectors/atlassian.ts → (unchanged)
```

## Wiring Example

```typescript
// app/(chat)/api/chat/route.ts
import { config } from '@/shared/config';
import { ContextService } from '@/core/context/context.service';
import { QdrantAdapter } from '@/infrastructure/qdrant/qdrant.adapter';
import { DrizzleAdapter } from '@/infrastructure/database/drizzle.adapter';
import { InMemoryEventBus } from '@/infrastructure/events/in-memory-event-bus';
import { ToolRegistry } from '@/infrastructure/ai/tool-registry';

// 1. Infrastructure (edges)
const vectorSearch = new QdrantAdapter(
  config.vector.url,
  config.vector.apiKey,
  config.vector.collectionName
);

const database = new DrizzleAdapter(config.database.url);
const eventBus = new InMemoryEventBus();
const toolRegistry = new ToolRegistry();

// 2. Core (center)
const contextService = new ContextService(vectorSearch, database);

// 3. Wire event handlers
eventBus.subscribe('chat.created', async (event) => {
  // Handle side effects
});

// 4. Use in route
export async function POST(request: Request) {
  const body = await request.json();
  
  const context = await contextService.buildContext({
    query: body.message,
    userId: body.userId,
    chatId: body.chatId
  });
  
  // Process with context...
}
```

## Module Responsibilities

### Core
- **Entities**: Business objects with behavior (`ChatEntity`)
- **Domain Events**: Significant business occurrences (`ChatCreatedEvent`)
- **Repository Ports**: Interfaces for persistence
- **Service Ports**: Interfaces for external capabilities

### Shared
- **Config**: Centralized environment configuration
- **Service Ports**: Abstract interfaces (VectorSearch, Database, Events, AI)
- **No implementations** - just contracts

### Infrastructure
- **Adapters**: Implement Shared ports using external libraries
- **QdrantAdapter**: Vector search via Qdrant client
- **DrizzleAdapter**: Database via Drizzle ORM
- **McpAdapter**: MCP tool execution
- **InMemoryEventBus**: Event publishing/subscribing
- **ToolRegistry**: Tool registration and lookup

### App
- **Routes**: Next.js API routes
- **Components**: React components
- **Wiring**: Dependency injection and composition

## Benefits

1. **Testability**: Mock ports, test business logic in isolation
2. **Swappability**: Change Qdrant→Pinecone, Drizzle→Prisma without touching core
3. **Clear Boundaries**: Know exactly where business logic lives
4. **Framework Agnostic**: Core could be used in CLI, API, or worker
5. **High Cohesion**: Each module has single, well-defined responsibility
6. **No Env Pollution**: Single config file, validated at startup
