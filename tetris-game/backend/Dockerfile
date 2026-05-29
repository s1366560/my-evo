# ============================================================
# Tetris Game - Backend Dockerfile (Node.js + Express + WebSocket)
# ============================================================

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production


# ---- Production Stage ----
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S tetris && adduser -S tetris -u 1001

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init wget ca-certificates

# Copy package files for production install
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R tetris:tetris /app

# Switch to non-root user
USER tetris

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/health" || exit 1

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
