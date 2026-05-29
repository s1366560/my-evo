# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js)
# ============================================================
# Build context: project root (.)
# Build command: docker build -f frontend/Dockerfile .

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from frontend/ relative to context
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build Next.js application
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S evomap && adduser -S evomap -u 1001

WORKDIR /app/frontend

# Install only production dependencies
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./package.json

# Copy built artifacts
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public

# Set ownership
RUN chown -R evomap:evomap /app/frontend

# Switch to non-root user
USER evomap

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "run", "start"]
