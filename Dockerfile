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

# Build root monorepo TypeScript
RUN npm run build

# Build my-evo backend TypeScript
RUN cd backend && npm install && npm run build

# Prune dev dependencies
RUN npm prune --production


# ---- Production Stage ----
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S evomap && adduser -S evomap -u 1001

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init wget ca-certificates openssl

# Copy package files for production install
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production --ignore-scripts

# Copy root prisma schema for migrations
COPY prisma ./prisma

# Copy backend package files for production install
COPY backend/package*.json ./backend/

# Copy backend prisma schema BEFORE running prisma generate
COPY backend/prisma ./backend/prisma

WORKDIR /app/backend
# Install production deps AND dev deps so Prisma engine binaries are present
RUN npm ci --include=dev --ignore-scripts && npx prisma generate
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma

# Copy source scripts
COPY src/scripts ./src/scripts

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
  CMD ["wget", "-qO-", "http://localhost:${PORT:-3001}/health"]

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run schema sync then start server
CMD ["sh", "-c", "cd backend && npx prisma db push --skip-generate --accept-data-loss && node dist/index.js"]
