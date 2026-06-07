FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Install dependencies for sharp (image processing)
RUN apk add --no-cache libc6-compat

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

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time environment variables (required for config validation during build)
# These are dummy values - actual values are set at runtime
ARG AUTH_SECRET=build-time-dummy-secret
ARG POSTGRES_URL=postgresql://localhost:5432/build
ARG PROVIDER_API_KEY=build-time-dummy-key
ARG PROVIDER_BASE_URL=http://localhost:8080
ARG PROVIDER_MODEL=build-model
ARG QDRANT_URL=http://localhost:6333
ARG ENCRYPTION_KEY=cd3b480d3b276a64406bb9b97167eb434bdc6d6e7ecc463cc83ca5b6debd9863
ARG AZURE_AD_TENANT_ID=build-time-azure-ad-tenant-id
ARG AZURE_AD_CLIENT_ID=build-time-azure-ad-client-id
ARG AZURE_AD_CLIENT_SECRET=build-time-azure-ad-client-secret

ENV AUTH_SECRET=${AUTH_SECRET}
ENV AUTH_EMAIL_GROUPS=${AUTH_EMAIL_GROUPS}
ENV POSTGRES_URL=${POSTGRES_URL}
ENV PROVIDER_API_KEY=${PROVIDER_API_KEY}
ENV PROVIDER_BASE_URL=${PROVIDER_BASE_URL}
ENV PROVIDER_MODEL=${PROVIDER_MODEL}
ENV QDRANT_URL=${QDRANT_URL}
ENV ENCRYPTION_KEY=${ENCRYPTION_KEY}
ENV AZURE_AD_TENANT_ID=${AZURE_AD_TENANT_ID}
ENV AZURE_AD_CLIENT_ID=${AZURE_AD_CLIENT_ID}
ENV AZURE_AD_CLIENT_SECRET=${AZURE_AD_CLIENT_SECRET}

# Build the Next.js application (skip migrations - they run at startup)
RUN pnpm next build

# =============================================================================
# Runner stage
# =============================================================================
FROM base AS runner

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    POSTGRES_URL=${POSTGRES_URL:-}

# Create app directory
WORKDIR /app

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Copy built application (standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/ping').then(r=>{process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))" 

# Start the application (run migrations first)
CMD ["sh", "-c", "pnpm tsx lib/db/migrate && node server.js"]
