# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js)
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Copy package files (context is ./frontend)
COPY package*.json ./

# Install dependencies (with retry for transient network errors)
# Try npm ci with cache, fall back to npm install if needed
RUN /bin/sh -c ' \
    for i in 1 2 3; do \
        npm ci --ignore-scripts && exit 0; \
        echo "[npm ci retry $i of 3]"; \
        sleep 3; \
    done; \
    npm ci --ignore-scripts && exit 0; \
    npm install'

# Copy source code
COPY . .

# Build Next.js application (with retry)
RUN /bin/sh -c ' \
    for i in 1 2 3; do \
        npm run build && exit 0; \
        echo "[npm run build retry $i of 3]"; \
        sleep 2; \
    done; \
    npm run build'

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=http://backend:3001

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
