# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Enable pnpm and install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source files and build (exclude test files)
COPY src/ ./src/
RUN rm -rf src/*.test.ts
COPY tsconfig.json ./
RUN pnpm run build

# Stage 2: Run
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy public directory
COPY public/ ./public/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
