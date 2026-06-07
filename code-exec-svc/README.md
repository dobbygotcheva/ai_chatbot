# Code Execution Service API

Sandboxed code execution service with Docker isolation. Execute Python, JavaScript, and Bash code securely with resource limits and network isolation.

## Table of Contents

- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
  - [POST /api/execute](#post-apiexecute)
  - [GET /health](#get-health)
  - [GET /metrics](#get-metrics)
- [Error Codes](#error-codes)
- [Rate Limits](#rate-limits)
- [Security Features](#security-features)
- [Configuration](#configuration)
- [Testing](#testing)

---

## Quick Start

### Running with Docker

```bash
# Start the service
docker compose up -d code-exec-svc

# View logs
docker compose logs -f code-exec-svc

# Stop the service
docker compose down code-exec-svc
```

### Running Locally

```bash
# Install dependencies
pnpm install

# Build the service
pnpm build

# Start the service
pnpm start
```

### Test the Service

```bash
# Health check
curl http://localhost:5001/health

# Execute Python code
curl -X POST http://localhost:5001/api/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"code":"print(\"Hello, World!\")","language":"python"}'
```

---

## API Endpoints

### POST /api/execute

Execute code in a sandboxed Docker container.

**Authentication**: Requires `X-API-Key` header (unless `AUTH_DISABLED=true`)

#### Request Schema

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `code` | string | Yes | Max 100KB (102400 chars) | Source code to execute |
| `language` | string | Yes | `python`, `javascript`, or `bash` | Programming language |
| `timeout` | number | No | 1000-60000ms (default: 30000) | Execution timeout in milliseconds |

#### Request Example

```json
{
  "code": "print('Hello, World!')",
  "language": "python",
  "timeout": 5000
}
```

#### Success Response (200 OK)

```json
{
  "execution_id": "exec_1712150400000_abc123",
  "status": "success",
  "stdout": "Hello, World!\n",
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 234,
  "files": [],
  "images": [],
  "truncated": false
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `execution_id` | string | Unique identifier for this execution |
| `status` | string | `success` if exit_code is 0, otherwise `error` |
| `stdout` | string | Standard output from execution |
| `stderr` | string | Standard error from execution |
| `exit_code` | number | Process exit code (0 = success) |
| `duration_ms` | number | Execution duration in milliseconds |
| `files` | array | Generated files (name, base64 content, size in bytes) |
| `images` | array | Generated images (name, content_type, base64 content) |
| `truncated` | boolean | True if output exceeded 1MB limit |

#### Error Response (500 Internal Server Error)

```json
{
  "error": "TimeoutError",
  "message": "Execution timeout after 30000ms"
}
```

#### curl Examples

**Python:**
```bash
curl -X POST http://localhost:5001/api/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "print(2 ** 10)",
    "language": "python"
  }'
```

**JavaScript:**
```bash
curl -X POST http://localhost:5001/api/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "console.log(Math.random())",
    "language": "javascript"
  }'
```

**Bash:**
```bash
curl -X POST http://localhost:5001/api/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "echo \"Current user: $(whoami)\"",
    "language": "bash"
  }'
```

**With custom timeout:**
```bash
curl -X POST http://localhost:5001/api/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "code": "import time; time.sleep(2)",
    "language": "python",
    "timeout": 5000
  }'
```

---

### GET /health

Health check endpoint. Returns service status and Docker connectivity.

**Authentication**: Not required

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `healthy` or `unhealthy` |
| `uptime` | number | Service uptime in seconds |
| `queue_size` | number | Number of executions waiting in queue |
| `docker_connected` | boolean | True if Docker daemon is reachable |
| `timestamp` | string | ISO 8601 timestamp |
| `error` | string | Error message (only present when unhealthy) |

#### Success Response (200 OK)

```json
{
  "status": "healthy",
  "uptime": 3600,
  "queue_size": 2,
  "docker_connected": true,
  "timestamp": "2026-04-06T10:30:00.000Z"
}
```

#### Unhealthy Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "uptime": 3600,
  "queue_size": 0,
  "docker_connected": false,
  "error": "Cannot connect to Docker daemon",
  "timestamp": "2026-04-06T10:30:00.000Z"
}
```

#### curl Example

```bash
curl http://localhost:5001/health
```

---

### GET /metrics

Execution metrics endpoint. Returns aggregated statistics since service start.

**Authentication**: Not required

#### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `execution_count` | number | Total number of executions |
| `success_count` | number | Number of successful executions |
| `error_count` | number | Number of failed executions |
| `total_duration_ms` | number | Sum of all execution durations |
| `avg_duration_ms` | number | Average execution duration |
| `language_counts` | object | Execution count per language |

#### Response Example

```json
{
  "execution_count": 150,
  "success_count": 145,
  "error_count": 5,
  "total_duration_ms": 45000,
  "avg_duration_ms": 300,
  "language_counts": {
    "python": 100,
    "javascript": 40,
    "bash": 10
  }
}
```

#### curl Example

```bash
curl http://localhost:5001/metrics
```

---

## Error Codes

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `Validation failed` | 400 | Request body is invalid or missing required fields |
| `Unauthorized` | 401 | Missing or invalid API key |
| `Too Many Requests` | 429 | Rate limit exceeded (more than 10 requests/minute) |
| `TimeoutError` | 500 | Execution exceeded the specified timeout |
| `ResourceError` | 500 | Resource limit exceeded (memory, CPU, processes) |
| `SecurityError` | 500 | Security violation detected |
| `ExecutionError` | 500 | Generic execution failure |
| `Not found` | 404 | Unknown endpoint |
| `Internal server error` | 500 | Unexpected server error |

### Validation Error Details

When validation fails (400), the response includes detailed field errors:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "code",
      "message": "Code must be less than 100KB (102400 characters)"
    },
    {
      "field": "language",
      "message": "Language must be python, javascript, or bash"
    }
  ]
}
```

---

## Rate Limits

| Limit | Value | Description |
|-------|-------|-------------|
| Requests per minute | 10 | Per IP address |
| Concurrent executions | 10 | Maximum parallel executions |
| Code size | 100KB | Maximum code payload size |
| Output size | 1MB | Maximum stdout/stderr size (truncated if exceeded) |

### Rate Limit Headers

When rate limited, the response includes standard headers:

- `RateLimit-Limit`: Maximum requests allowed (10)
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Unix timestamp when the rate limit resets

### Rate Limit Response (429 Too Many Requests)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 requests per minute."
}
```

---

## Security Features

The service implements multiple layers of security isolation:

### Container Isolation

| Feature | Configuration | Description |
|---------|---------------|-------------|
| Network isolation | `NetworkDisabled: true` | No outbound network access from containers |
| Capability dropping | `CapDrop: ['ALL']` | All Linux capabilities removed |
| Read-only root | Tmpfs mounts | Root filesystem is read-only |
| Temporary storage | `/tmp` (tmpfs, 100MB) | Writable tmpfs with noexec,nosuid flags |
| Workspace volume | Named volume | Isolated volume per execution |

### Resource Limits

| Resource | Limit | Description |
|----------|-------|-------------|
| Memory | 512MB | Maximum memory per container |
| CPU | 1 core | CPU quota (100000 microseconds) |
| Processes | 50 pids | Maximum number of processes |
| Timeout | 60 seconds | Maximum execution time |

### Filesystem Security

- `/tmp` mounted as tmpfs with `noexec,nosuid` flags (100MB limit)
- Read-only root filesystem prevents writes to system directories
- Base64 encoding prevents injection attacks in file writing
- Generated files stored in `/tmp` (automatically cleaned up after execution)

### Authentication

- API key authentication via `X-API-Key` header
- Timing-safe comparison prevents timing attacks
- Can be disabled for development with `AUTH_DISABLED=true`

---

## Configuration

Environment variables for configuring the service:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5001 | HTTP server port |
| `AUTH_DISABLED` | false | Disable API key authentication (development only) |
| `API_KEYS` | (empty) | Comma-separated list of valid API keys |
| `DOCKER_SOCKET` | /var/run/docker.sock | Path to Docker socket |
| `DEFAULT_TIMEOUT` | 30000 | Default execution timeout in milliseconds |
| `MAX_TIMEOUT` | 60000 | Maximum allowed timeout in milliseconds |
| `MAX_CONCURRENT_EXECUTIONS` | 5 | Maximum concurrent executions (deprecated, use rate limiter) |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Maximum requests per window (note: actual limit is 10/minute in code) |

### Example .env File

```bash
# Server
PORT=5001

# Authentication
AUTH_DISABLED=false
API_KEYS=your-secret-key-1,your-secret-key-2

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# Execution
DEFAULT_TIMEOUT=30000
MAX_TIMEOUT=60000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10
```

### Generating API Keys

```bash
# Generate a random API key
openssl rand -hex 32
```

---

## Supported Languages

| Language | Runtime Image | Interpreter | File Extension |
|----------|---------------|-------------|----------------|
| Python | `code-exec-python` | `python3` | `.py` |
| JavaScript | `code-exec-node` | `node` | `.js` |
| Bash | `code-exec-bash` | `bash` | `.sh` |

---

## Lifecycle

1. **Container Creation**: A new container is created with the specified runtime image
2. **Code Execution**: Code is base64-encoded, written to `/tmp`, and executed
3. **Output Collection**: stdout, stderr, and exit code are captured
4. **File Collection**: Files in `/tmp` are collected (including images)
5. **Container Cleanup**: Container is destroyed (tmpfs auto-cleaned)

Containers are ephemeral and destroyed after each execution, ensuring clean state for every request.

---

## Testing

### Running Tests

```bash
# Run all tests (requires Docker)
pnpm test

# Run only benchmarks (works without Docker in simulation mode)
pnpm run benchmark

# Run integration tests (requires Docker + runtime images)
pnpm run test:integration
```

### Prerequisites for Testing

1. Docker daemon running
2. User has permissions to access `/var/run/docker.sock`
3. Runtime images built (`code-exec-python`, `code-exec-node`, `code-exec-bash`)

See [TEST_STATUS.md](./TEST_STATUS.md) for detailed instructions.

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Security

See [SECURITY.md](./SECURITY.md) for detailed security documentation.
