# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js)
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Copy package files (context is ./frontend)
COPY package*.json ./

# Install dependencies (with retry for transient network errors)
RUN sh -c 'for i in 1 2 3; do npm ci && break || { echo "[npm ci retry $i]"; sleep 3; }; done'

# Copy source code
COPY . .

# Build Next.js application (with retry)
RUN sh -c 'for i in 1 2 3; do npm run build && break || { echo "[npm build retry $i]"; sleep 2; }; done'

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=http://backend:3001

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
