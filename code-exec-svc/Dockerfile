FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Set working directory
WORKDIR /app

# =============================================================================
# Dependencies stage
# =============================================================================
FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# =============================================================================
# Builder stage
# =============================================================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile TypeScript
RUN pnpm run build

# =============================================================================
# Runtime stage
# =============================================================================
FROM base AS runtime


# Install Docker CLI (not daemon) for container orchestration
# Install seccomp dependencies and Docker CLI client
RUN apk add --no-cache \
    docker-cli \
    curl \
    jq \
    socat

# Copy seccomp profile
COPY seccomp-profile.json /etc/docker/seccomp-profile.json

# Set environment variables
ENV NODE_ENV=production \
    PORT=5001 \
    DOCKER_HOST=tcp://code-exec-dind:2375

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./



# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 5001

# Start the application
CMD ["node", "dist/index.js"]
