# LLM Proxy Server

Rust-based proxy server for controlled LLM API access. Provides API token authentication, request queuing, circuit breaker protection, and Prometheus-compatible metrics.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Client    │────▶│  API Token   │────▶│ Worker Pool │────▶│  Upstream LLM    │
│  (Next.js)  │     │  Validation  │     │  (4 workers)│     │  Provider API    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────────┘
                           │                    │
                           │                    ▼
                           │             ┌─────────────┐
                           │             │   Circuit   │
                           │             │  Breaker    │
                           │             └─────────────┘
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (ApiToken   │
                    │   table)     │
                    └──────────────┘
```

### Request Flow

1. **Client Request**: Next.js app sends request with `Authorization: Bearer <token>` header
2. **Token Validation**: Middleware validates token against `ApiToken` table (decrypts and compares)
3. **Queue Request**: Valid requests enter worker pool queue
4. **Circuit Breaker**: Checks if upstream is healthy (closed/open/half-open state)
5. **Worker Processing**: One of 4 workers processes the request
6. **Upstream Call**: Worker forwards to LLM provider with timeout
7. **Response**: Result returned to client, metrics logged

### Components

| Component | Purpose |
|-----------|---------|
| **API Token Middleware** | Validates Bearer tokens, updates `lastUsedAt` |
| **Worker Pool** | Concurrent request processing with configurable workers |
| **Circuit Breaker** | Protects upstream from cascading failures |
| **Metrics State** | Tracks requests, errors, latency (Prometheus format) |
| **Health Check** | Verifies database and upstream connectivity |

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `ENCRYPTION_KEY` | 32-byte hex key for token encryption (same as McpSession) | `3cff04a462879db250cc069aff9c645db58ba96241259a7033fe59e54dca61ad` |
| `UPSTREAM_BASE_URL` | LLM provider API gateway URL | `https://ai-api.egt-digital.com/gateway/v1/` |

### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` (staging), `3003` (prod) | Server port |
| `WORKER_COUNT` | `4` | Number of worker threads |
| `QUEUE_SIZE` | `100` | Request queue capacity |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Failures before circuit opens |
| `CLIENT_TIMEOUT_SECS` | `120` | Client request timeout |
| `UPSTREAM_TIMEOUT_SECS` | `90` | Upstream timeout (must be < CLIENT_TIMEOUT_SECS) |

### Validation Rules

- `UPSTREAM_TIMEOUT_SECS` must be less than `CLIENT_TIMEOUT_SECS`
- `WORKER_COUNT` must be greater than 0
- `QUEUE_SIZE` must be greater than 0
- `CIRCUIT_BREAKER_THRESHOLD` must be greater than 0

## Local Development

### Prerequisites

1. **Install Rust** (if not already installed):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **Verify Rust installation**:
   ```bash
   rustc --version
   cargo --version
   ```

### Setup Steps

1. **Navigate to proxy-server directory**:
   ```bash
   cd proxy-server
   ```

2. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** with your local values:
   ```bash
   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/ai_chatbot
   ENCRYPTION_KEY=<your-32-byte-hex-key>
   UPSTREAM_BASE_URL=https://ai-api.egt-digital.com/gateway/v1/
   PORT=3002
   ```

4. **Run database migrations** (from ai_chatbot directory):
   ```bash
   cd ../ai_chatbot && pnpm db:migrate
   ```

5. **Start the proxy server**:
   ```bash
   cd ../proxy-server && cargo run
   ```

6. **Verify health endpoint**:
   ```bash
   curl http://localhost:3002/health
   ```
   Expected response: `OK` (HTTP 200)

7. **Test metrics endpoint**:
   ```bash
   curl http://localhost:3002/metrics
   ```

### Running Tests

```bash
# Run all tests
cargo test

# Run specific test module
cargo test config
cargo test auth
cargo test metrics
cargo test proxy

# Run tests with output
cargo test -- --nocapture
```

## Deployment

### Docker Build

The proxy server uses a multi-stage Docker build for minimal production image size:

```bash
# Build Docker image
docker build -t rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:latest ./proxy-server

# Tag with commit SHA
docker tag rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:latest \
         rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:<commit-sha>

# Push to registry
docker push rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:latest
docker push rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:<commit-sha>
```

### Docker Compose Deployment

The proxy is deployed via Docker Compose alongside other services:

```yaml
# docker-compose.staging.yml (excerpt)
llm-proxy:
  image: rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:${CI_COMMIT_SHORT_SHA:-latest}
  ports:
    - "3002:3002"
  environment:
    POSTGRES_URL: postgresql://postgres:postgres@postgres:5432/ai_chatbot
    ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    UPSTREAM_BASE_URL: https://ai-api.egt-digital.com/gateway/v1/
    PORT: 3002
    WORKER_COUNT: 4
    QUEUE_SIZE: 100
  networks:
    - ai_center_staging
  depends_on:
    - postgres
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3002/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
```

### GitLab CI/CD Pipeline

The proxy is built and deployed automatically:

```yaml
# Build stage (development and main branches)
build:llm-proxy:
  stage: build-deps
  script:
    - docker build -t $LLM_PROXY_IMAGE:$CI_COMMIT_SHORT_SHA -t $LLM_PROXY_IMAGE:latest ./proxy-server
    - docker push $LLM_PROXY_IMAGE:$CI_COMMIT_SHORT_SHA
    - docker push $LLM_PROXY_IMAGE:latest

# Deploy stage (development → staging)
deploy-staging:
  stage: deploy-staging
  script:
    - docker pull $LLM_PROXY_IMAGE:$CI_COMMIT_SHORT_SHA
    - docker compose -p ai_center_staging -f docker-compose.staging.yml up -d
```

### Manual Deployment

```bash
# Pull latest image
docker pull rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:latest

# Stop existing container
docker compose -p ai_center_staging stop llm-proxy

# Start with new image
docker compose -p ai_center_staging up -d llm-proxy

# Verify health
docker compose -p ai_center_staging exec llm-proxy wget -q -O- http://localhost:3002/health
```

## API Documentation

### Authentication

All proxy endpoints require API token authentication via Bearer token:

```
Authorization: Bearer <your-api-token>
```

API tokens are created via the Next.js API endpoint (see below).

---

### POST /api/tokens (Next.js)

Create a new API token for LLM proxy access.

**Endpoint**: `POST http://localhost:3000/api/tokens`

**Authentication**: Next.js session (Azure AD)

**Permissions Required**: `LLM:read`

**Request Body**:
```json
{
  "name": "My API Token",
  "expiresInDays": 90
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "tokenId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My API Token",
    "token": "sk_live_abc123...",  // ⚠️ Only shown once!
    "expiresAt": "2026-07-15T00:00:00Z"
  }
}
```

**Error Responses**:

403 Forbidden:
```json
{
  "success": false,
  "error": "forbidden",
  "message": "Insufficient permissions"
}
```

429 Too Many Requests:
```json
{
  "success": false,
  "error": "rate_limited",
  "message": "Rate limit exceeded: 5 tokens per hour"
}
```

---

### POST /v1/chat/completions (Proxy)

OpenAI-compatible chat completions endpoint.

**Endpoint**: `POST http://localhost:3002/v1/chat/completions`

**Authentication**: Bearer token (API token created via `/api/tokens`)

**Request Headers**:
```
Authorization: Bearer sk_live_abc123...
Content-Type: application/json
```

**Request Body**:
```json
{
  "model": "foundation",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Response** (200 OK):
```json
{
  "id": "chatcmpl-550e8400-e29b-41d4-a716-446655440000",
  "object": "chat.completion",
  "created": 1713225600,
  "model": "foundation",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

**Error Responses**:

401 Unauthorized:
```json
{
  "error": {
    "message": "Invalid API token",
    "type": "proxy_error"
  }
}
```

503 Service Unavailable (Circuit Breaker Open):
```json
{
  "error": {
    "message": "Service temporarily unavailable - circuit breaker open",
    "type": "proxy_error"
  }
}
```

504 Gateway Timeout:
```json
{
  "error": {
    "message": "Gateway timeout - upstream did not respond",
    "type": "proxy_error"
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3002/v1/chat/completions \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "foundation",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

### GET /metrics

Prometheus-compatible metrics endpoint.

**Endpoint**: `GET http://localhost:3002/metrics`

**Authentication**: None (internal endpoint)

**Response** (200 OK):
```
# HELP proxy_requests_total Total number of requests
# TYPE proxy_requests_total counter
proxy_requests_total{status="success"} 150
proxy_requests_total{status="error"} 5
# HELP proxy_queue_depth Current queue depth
# TYPE proxy_queue_depth gauge
proxy_queue_depth 2
# HELP proxy_upstream_errors_total Total upstream errors
# TYPE proxy_upstream_errors_total counter
proxy_upstream_errors_total 3
# HELP proxy_request_duration_seconds Request duration in seconds
# TYPE proxy_request_duration_seconds histogram
proxy_request_duration_seconds{quantile="0.5"} 1.2
proxy_request_duration_seconds{quantile="0.9"} 1.8
proxy_request_duration_seconds{quantile="0.99"} 2.5
```

**cURL Example**:
```bash
curl http://localhost:3002/metrics
```

---

### GET /health

Health check endpoint for container orchestration.

**Endpoint**: `GET http://localhost:3002/health`

**Authentication**: None

**Response** (200 OK):
```
OK
```

**Response** (503 Service Unavailable):
```
Service Unavailable
```

**Checks Performed**:
1. Database connectivity (SELECT 1)
2. Upstream connectivity (HTTP GET to UPSTREAM_BASE_URL with 5s timeout)

**cURL Example**:
```bash
curl -v http://localhost:3002/health
```

---

## Operations

### Monitoring

#### Prometheus Metrics

The `/metrics` endpoint exposes the following metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `proxy_requests_total` | Counter | `status` (success/error) | Total requests processed |
| `proxy_queue_depth` | Gauge | None | Current queue depth |
| `proxy_upstream_errors_total` | Counter | None | Total upstream errors |
| `proxy_request_duration_seconds` | Histogram | `quantile` (0.5/0.9/0.99) | Request latency |
| `proxy_circuit_breaker_state` | Gauge | None | 0=closed, 1=open, 2=half-open |

#### Health Checks

The `/health` endpoint performs two checks:

1. **Database**: `SELECT 1` query via sqlx
2. **Upstream**: HTTP GET to `UPSTREAM_BASE_URL` with 5-second timeout

Returns 200 OK if both pass, 503 if either fails.

#### Log Aggregation

Logs are output to stdout using `tracing-subscriber` with JSON formatting in production:

```bash
# View recent logs
docker compose -p ai_center_staging logs llm-proxy

# Follow logs in real-time
docker compose -p ai_center_staging logs -f llm-proxy

# Filter by log level
docker compose -p ai_center_staging logs llm-proxy | grep ERROR
```

Log levels:
- `INFO`: Startup, health checks
- `DEBUG`: Request processing details
- `WARN`: Circuit breaker state changes, validation failures
- `ERROR`: Upstream errors, database errors

### Troubleshooting

#### Common Issues

**1. "Missing Authorization header" (401)**

Cause: Request missing `Authorization: Bearer <token>` header.

Solution:
```bash
curl -H "Authorization: Bearer sk_live_..." http://localhost:3002/v1/chat/completions
```

**2. "Invalid API token" (401)**

Causes:
- Token expired (check `expiresAt`)
- Token revoked (check `revokedAt`)
- Token not found in database

Solution:
```bash
# Check token in database
psql <connection> -c "SELECT id, \"userId\", \"expiresAt\", \"revokedAt\" FROM \"ApiToken\" WHERE id = '<token-id>'"

# Create new token via Next.js API
curl -X POST http://localhost:3000/api/tokens -H "Content-Type: application/json" -d '{"name": "New Token", "expiresInDays": 90}'
```

**3. "Circuit breaker open" (503)**

Cause: 5+ consecutive upstream failures.

Solution:
1. Check upstream service health
2. Wait for recovery timeout (30 seconds default)
3. Circuit transitions to half-open, allows one test request
4. On success, circuit closes

Check circuit state:
```bash
curl http://localhost:3002/metrics | grep circuit_breaker
```

**4. "Gateway timeout" (504)**

Cause: Upstream did not respond within `UPSTREAM_TIMEOUT_SECS` (default: 90s).

Solution:
- Check upstream service logs
- Verify network connectivity
- Consider increasing `UPSTREAM_TIMEOUT_SECS` if legitimate long-running requests

**5. "Service temporarily overloaded" (429)**

Cause: Request queue is full (default: 100 requests).

Solution:
- Scale worker count: `WORKER_COUNT=8`
- Increase queue size: `QUEUE_SIZE=200`
- Check for slow upstream responses causing backlog

#### Checking Logs

```bash
# Docker logs
docker compose -p ai_center_staging logs llm-proxy

# Filter by request ID
docker compose -p ai_center_staging logs llm-proxy | grep "550e8400-e29b-41d4-a716-446655440000"

# JSON logs (production)
docker compose -p ai_center_staging logs llm-proxy | jq 'select(.level == "ERROR")'
```

#### Restarting Service

```bash
# Graceful restart (Docker Compose)
docker compose -p ai_center_staging restart llm-proxy

# Force restart
docker compose -p ai_center_staging up -d --force-recreate llm-proxy

# Verify health after restart
curl http://localhost:3002/health
```

#### Database Queries

```bash
# List all active tokens
psql <connection> -c "SELECT id, \"userId\", name, \"expiresAt\", \"lastUsedAt\" FROM \"ApiToken\" WHERE \"revokedAt\" IS NULL ORDER BY \"createdAt\" DESC"

# Find expired tokens
psql <connection> -c "SELECT id, \"userId\", \"expiresAt\" FROM \"ApiToken\" WHERE \"expiresAt\" < NOW()"

# Check token usage audit log
psql <connection> -c "SELECT * FROM \"ProxyAudit\" ORDER BY \"createdAt\" DESC LIMIT 10"
```

## Phase 2 Roadmap

The following features are planned for future releases:

### Token Management

- [ ] **Token Revocation Endpoint**: `DELETE /api/tokens/:tokenId`
- [ ] **Token Listing**: `GET /api/tokens` with pagination
- [ ] **Token Details**: `GET /api/tokens/:tokenId`
- [ ] **Per-Token Rate Limits**: Configurable limits per token
- [ ] **Token Scopes**: Granular permissions (read/write/admin)

### Monitoring & Observability

- [ ] **Usage Dashboard**: Grafana dashboard for token usage metrics
- [ ] **Alerting**: Prometheus alerts for circuit breaker, error rates
- [ ] **Distributed Tracing**: OpenTelemetry integration
- [ ] **Request Logging**: Structured JSON logs with correlation IDs

### Performance & Scalability

- [ ] **Multiple LLM Providers**: Support for multiple upstream providers
- [ ] **Load Balancing**: Round-robin or weighted routing between providers
- [ ] **Request Caching**: Cache frequent responses (Redis)

### Security Enhancements

- [ ] **Token Hash Lookup**: Store hash for O(1) token lookup (vs O(n) decryption)
- [ ] **IP Whitelisting**: Restrict token usage to specific IPs
- [ ] **Audit Log Export**: Export audit logs to S3/blob storage
- [ ] **Key Rotation**: Automated encryption key rotation

## Known Limitations

### Token Lookup Performance

**Issue**: Token validation requires decrypting all non-revoked tokens for comparison (O(n) complexity).

**Reason**: AES-256-GCM uses random nonces, so encrypted values differ even for same plaintext.

**Impact**: Performance degrades with large token counts (>1000 tokens).

**Workaround**: Implement token hash lookup (store SHA-256 hash of plaintext for O(1) lookup, then decrypt only matching token).

**Tracking**: Phase 2 security enhancement.

### Single Upstream Provider

**Issue**: Only one upstream provider configured at a time.

**Reason**: Simplified initial architecture.

**Impact**: No fallback if primary provider fails (circuit breaker just opens).

**Workaround**: Manual configuration change and redeploy.

**Tracking**: Phase 2 scalability enhancement.

### Estimated Token Counts

**Issue**: Token counts are estimated (characters / 4) rather than using tiktoken.

**Reason**: Avoids additional dependency and computational overhead.

**Impact**: Token usage metrics are approximate, not exact.

**Workaround**: Use upstream provider's actual token counts from response.

**Tracking**: Future enhancement (low priority).

## Rollback Procedures

### Docker Compose Rollback

If a deployment causes issues, rollback to previous version:

```bash
# 1. Identify previous working image tag
docker images | grep proxy

# 2. Pull previous version (if not already cached)
docker pull rd-gitlab.egt-bg.com:4567/sm/ai_center/proxy:<previous-sha>

# 3. Stop current deployment
docker compose -p ai_center_staging down llm-proxy

# 4. Update docker-compose.staging.yml (or use environment variable)
# Change image tag from ${CI_COMMIT_SHORT_SHA} to <previous-sha>

# 5. Start previous version
docker compose -p ai_center_staging up -d llm-proxy

# 6. Verify health
curl http://localhost:3002/health

# 7. Check logs for errors
docker compose -p ai_center_staging logs -f llm-proxy
```

### GitLab CI/CD Rollback

To rollback via GitLab:

1. Navigate to **CI/CD > Pipelines**
2. Find the last successful pipeline
3. Click **Retry** or manually deploy the previous image tag
4. Update deployment variables to use previous `CI_COMMIT_SHORT_SHA`

### Database Rollback

If database migrations caused issues:

```bash
# No down migrations are implemented (Drizzle ORM limitation)
# Manual rollback requires:

# 1. Identify migration to rollback
psql <connection> -c "SELECT * FROM \"__DrizzleMigrations\" ORDER BY idx DESC LIMIT 5"

# 2. Manually reverse migration changes (DROP TABLE, ALTER COLUMN, etc.)
# WARNING: This may result in data loss!

# 3. Update migration journal
# Edit ai_chatbot/lib/db/migrations/meta/_journal.json
```

**Note**: Database rollbacks should only be performed by experienced operators with full backups.

### Emergency Shutdown

In case of critical issues:

```bash
# Stop proxy service immediately
docker compose -p ai_center_staging stop llm-proxy

# All traffic will fail - ensure this is intentional!
# Next.js app should handle 503 errors gracefully
```

## License

Proprietary - EGT Digital. All rights reserved.
