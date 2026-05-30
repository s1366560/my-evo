# ============================================================
# EvoMap Hub - Frontend Dockerfile (Next.js)
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Copy package files (context is ./frontend)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=http://backend:3001

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
