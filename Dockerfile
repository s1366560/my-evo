FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src ./src
COPY tsconfig.json ./
COPY next.config.js ./

# Install dependencies and build
RUN npm ci && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

# Start command
CMD ["node", ".next/standalone/server.js"]
