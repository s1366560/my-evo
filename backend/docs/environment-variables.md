# Environment Variables & Secrets Management

**Project**: My Evo Backend API  
**Version**: 1.0  
**Last Updated**: 2026-05-07

## Overview

This document describes all environment variables used by the My Evo backend, their purposes, security classifications, and best practices for secrets management.

## Environment File Location

The backend loads environment variables from:
```
.env
.env.local (if exists, takes precedence)
```

## Required Variables

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | PostgreSQL connection string or SQLite file path |

**Example:**
```bash
# SQLite (development)
DATABASE_URL=file:./dev.db

# PostgreSQL (production)
DATABASE_URL=postgresql://user:password@localhost:5432/myevo
```

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | `dev-secret-change-in-production` | Secret key for JWT token signing |

**⚠️ IMPORTANT:** Change this in production! Use a cryptographically secure random string.

**Example:**
```bash
# Generate a secure secret
openssl rand -base64 32
```

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment: `development`, `production`, `test` |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin |

## Optional Variables

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

### Redis Cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | - | Redis connection string for session/cache |

**Example:**
```bash
REDIS_URL=redis://localhost:6379
```

### External Services

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GDI_API_KEY` | No | - | API key for GDI scoring service |
| `GDI_API_URL` | No | - | Base URL for GDI scoring service |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `1` (INFO) | Log verbosity: 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR |

## Security Classification

### Critical (Must be set in production)

These variables contain sensitive data and **must never be committed to version control**:

| Variable | Reason |
|----------|--------|
| `DATABASE_URL` | Contains database credentials |
| `JWT_SECRET` | JWT signing key - controls authentication |
| `GDI_API_KEY` | External service API key |

### Sensitive (Should be set in production)

These should be configured but are less critical:

| Variable | Reason |
|----------|--------|
| `REDIS_URL` | Cache connection |
| `CORS_ORIGIN` | Controls allowed domains |

### Non-Sensitive (Safe to use defaults)

| Variable | Reason |
|----------|--------|
| `PORT` | Just a port number |
| `NODE_ENV` | Standard configuration |
| `RATE_LIMIT_*` | Rate limiting settings |

## Secrets Management

### Development

1. Copy `.env.example` to `.env`
2. Fill in required values
3. Never commit `.env` to git

### Production

Use one of the following secrets management approaches:

#### Option 1: Environment Files (Not Recommended for Production)

```bash
# Use .env.production (gitignored)
cp .env.example .env.production
# Edit with production values
```

#### Option 2: Docker Secrets

```yaml
# docker-compose.yml
services:
  api:
    image: myevo-api:latest
    secrets:
      - jwt_secret
      - database_url
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  database_url:
    file: ./secrets/database_url.txt
```

#### Option 3: Kubernetes Secrets

```yaml
# kubernetes/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: myevo-secrets
type: Opaque
stringData:
  JWT_SECRET: your-secure-secret-here
  DATABASE_URL: postgresql://...
```

#### Option 4: Cloud Secret Managers

- **AWS**: AWS Secrets Manager / Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault

```bash
# Example: AWS Parameter Store
aws ssm get-parameter --name /myevo/jwt-secret
```

### .env.example Template

Create `.env.example` with placeholder values:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/myevo
JWT_SECRET=change-this-to-a-secure-random-string

# Optional - Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Optional - Redis
REDIS_URL=redis://localhost:6379

# Optional - External Services
GDI_API_KEY=
GDI_API_URL=

# Optional - Logging
LOG_LEVEL=1
```

## Validation

The backend validates required environment variables on startup:

```typescript
// src/config/validation.ts
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

## Security Best Practices

1. **Never commit secrets** - Add `.env` to `.gitignore`
2. **Rotate secrets regularly** - Especially JWT_SECRET
3. **Use strong passwords** - Generate cryptographically secure values
4. **Limit access** - Restrict who can view production secrets
5. **Audit logging** - Log when secrets are accessed
6. **Use HTTPS** - Always use TLS in production
7. **Validate on startup** - Fail fast if required secrets are missing

## Startup Checklist

Before starting the server:

- [ ] `DATABASE_URL` is set (and database is accessible)
- [ ] `JWT_SECRET` is changed from default
- [ ] `NODE_ENV` is set appropriately
- [ ] `CORS_ORIGIN` includes your frontend domain
- [ ] All optional services (Redis, GDI API) are configured if needed
