# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js standalone)
# ============================================================

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Cap Node.js heap to fit within constrained Drone runner
ENV NODE_OPTIONS="--max-old-space-size=1500"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application (output: 'standalone' in next.config.mjs)
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S evomap && adduser -S evomap -u 1001

WORKDIR /app

# Set environment variables before COPY
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set ownership
RUN chown -R evomap:evomap /app

# Switch to non-root user
USER evomap

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Start standalone Next.js server
CMD ["sh", "-c", "node server.js"]
