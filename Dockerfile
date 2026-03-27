# EvoMap Dockerfile
# Multi-stage build for optimized production image

# ============ Build Stage ============
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ============ Production Stage ============
FROM node:18-alpine AS production

# Add labels
LABEL org.opencontainers.image.title="EvoMap"
LABEL org.opencontainers.image.description="AI Agent Self-Evolution Infrastructure"
LABEL org.opencontainers.image.version="1.0.0"

# Create app directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root user
RUN addgroup -g 1001 -S evomap && \
    adduser -S evomap -u 1001 -G evomap
USER evomap

# Start server
CMD ["node", "dist/index.js"]
