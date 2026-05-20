# ============================================================
# EvoMap Hub - Multi-Stage Dockerfile (Backend)
# ============================================================

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production


# ---- Production Stage ----
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S evomap && adduser -S evomap -u 1001

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init wget

# Copy built artifacts from builder (no npm ci needed in production stage)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema for migrations
COPY prisma ./prisma

# Set ownership
RUN chown -R evomap:evomap /app

# Switch to non-root user
USER evomap

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server (migrate only if DATABASE_URL is set)
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy || true; fi && node dist/index.js"]
