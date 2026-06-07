# AI Center

Monorepo containing the AI Chatbot, MCP Atlassian, and Crawl4AI services.

## Quick Start

### Development (Infrastructure Only)

```bash
# Start only infrastructure services (postgres, qdrant, mcp-atlassian, crawl4ai)
# --build is required for mcp-atlassian and crawl4ai (local Dockerfile builds)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Production (Full Stack)

```bash
# Start all services including ai_chatbot
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop all services
docker compose -f docker-compose.prod.yml down
```

### Configure Environment

Copy `ai_chatbot/.env.example` to `ai_chatbot/.env.local` and edit:

```bash
# Required: Generate a random secret
AUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Required: Your AI provider credentials
PROVIDER_API_KEY=<your-api-key>
PROVIDER_BASE_URL=<your-api-url>
PROVIDER_MODEL=<your-model>

# Browser access URL
AUTH_URL=http://localhost:3000

# Docker services URLs (internal network)
POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/ai_chatbot
QDRANT_URL=http://qdrant:6333
ATLASSIAN_MCP=http://mcp-atlassian:8000/mcp
CRAWLER_URL=http://crawl4ai:11235/crawl
```

### Run AI Chatbot Locally (Development)

```bash
cd ai_chatbot

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| AI Chatbot | http://localhost:3000 | Main chat interface (Docker production) |
| MCP Atlassian | http://localhost:8000 | Atlassian MCP server (Docker) |
| Crawl4AI | http://localhost:11235 | Web crawler (Docker) |
| PostgreSQL | localhost:5433 | Database (Docker) |
| Qdrant | http://localhost:6340 | Vector database UI (Docker) |

## Common Commands

```bash
# Start infrastructure only (development)
docker compose up -d

# Start full stack (production)
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose logs -f
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose down
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (resets databases)
docker compose down -v
docker compose -f docker-compose.prod.yml down -v

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

## Docker Compose Files

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.yml` | Development/Infrastructure | postgres, qdrant, mcp-atlassian, crawl4ai |
| `docker-compose.prod.yml` | Production (standalone) | ai_chatbot + all infrastructure |

## Project Structure

```
ai_center/
├── docker-compose.yml         # Infrastructure services only
├── docker-compose.prod.yml    # Full production stack (including ai_chatbot)
├── README.md                  # This file
├── ai_chatbot/                # Next.js AI chatbot
│   ├── .env.example           # Environment template
│   ├── .env.local             # Your local configuration
│   └── ...
├── mcp-atlassian/             # MCP Atlassian server (runs in Docker)
│   └── ...
└── crawl4ai/                  # Crawl4AI web crawler (runs in Docker)
    └── ...
```
