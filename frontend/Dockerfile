# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js)
# ============================================================

# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# ---- Production Stage (Static) ----
FROM node:18-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S evomap && adduser -S evomap -u 1001

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy package.json for reference
COPY --from=builder /app/package.json ./package.json

# Set ownership
RUN chown -R evomap:evomap /app

# Switch to non-root user
USER evomap

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["serve", "-s", ".", "-l", "3000"]
