# My Evo Architecture Documentation Index

**Project**: My Evo (evomap.ai Clone)  
**Version**: v1.0  
**Last Updated**: 2026-05-08  
**Status**: Complete

---

## Overview

This directory contains the complete architecture documentation for My Evo, organized into:

1. **Core Architecture Documents** - System design, API specs, database schema
2. **Component Specifications** - React components, state management, integration patterns
3. **Deployment & Operations** - Runbook, deployment procedures, rollback plans
4. **Diagrams** - Mermaid diagrams for visual reference

---

## Document Map

### Core Architecture

| Document | Description | Lines | Status |
|----------|-------------|-------|--------|
| [系统架构文档.md](./系统架构文档.md) | Chinese system architecture with detailed diagrams | 1308 | ✅ Complete |
| [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) | English system architecture overview | 272 | ✅ Complete |
| [API-SPEC.md](./API-SPEC.md) | Complete API specification with examples | 839 | ✅ Complete |
| [API-Endpoint-Specifications.md](./API-Endpoint-Specifications.md) | Endpoint reference table | 551 | ✅ Complete |

### Data Layer

| Document | Description | Lines | Status |
|----------|-------------|-------|--------|
| [Database-Schema-Reference.md](./Database-Schema-Reference.md) | Prisma schema documentation | 208 | ✅ Complete |
| [DATA-MODELS.md](./DATA-MODELS.md) | Data model specifications | 358 | ✅ Complete |
| [SPEC-appendix-2.md](./SPEC-appendix-2.md) | ER diagrams and relationships | 125 | ✅ Complete |

### Frontend & Components

| Document | Description | Lines | Status |
|----------|-------------|-------|--------|
| [SPEC-appendix-1.md](./SPEC-appendix-1.md) | React component hierarchy | 131 | ✅ Complete |
| [SPEC-appendix-3.md](./SPEC-appendix-3.md) | Integration points, state management | 113 | ✅ Complete |

### Operations

| Document | Description | Lines | Status |
|----------|-------------|-------|--------|
| [Deployment-Runbook.md](./Deployment-Runbook.md) | Deployment and rollback procedures | 404 | ✅ Complete |

### Features & Status

| Document | Description | Lines | Status |
|----------|-------------|-------|--------|
| [COMPLETED-FEATURES.md](./COMPLETED-FEATURES.md) | Feature completion matrix | 272 | ✅ Complete |

### Visual Diagrams

| Document | Description | Format |
|----------|-------------|--------|
| [diagrams/architecture.mmd](./diagrams/architecture.mmd) | Component diagrams, flows | Mermaid |

---

## Quick Reference

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, TypeScript, Tailwind, shadcn/ui, Zustand |
| **Backend** | Express.js, Prisma ORM, SQLite (dev), PostgreSQL (prod) |
| **Auth** | JWT with bcrypt |
| **Validation** | Zod schemas |
| **API Port** | 3001 |
| **Frontend Dev** | 3002 |
| **Frontend Prod** | 3000 |

### API Base URLs

| Environment | Backend | Frontend |
|-------------|---------|----------|
| Development | `http://localhost:3001` | `http://localhost:3002` |
| Production | `http://localhost:3001` | `http://localhost:3000` |

### Key Endpoints

| Category | Endpoints |
|----------|-----------|
| Auth | `/auth/register`, `/auth/login`, `/auth/me` |
| A2A | `/a2a/hello`, `/a2a/heartbeat`, `/a2a/publish` |
| Assets | `/assets`, `/assets/:id`, `/assets/search` |
| Bounty | `/bounty/list`, `/bounty/create`, `/bounty/:id/claim` |
| Map | `/map/nodes`, `/map/edges`, `/map/stats` |

### Database Models

| Model | Description |
|-------|-------------|
| User | Platform users with email/password auth |
| Node | Agent nodes registered via A2A protocol |
| Asset | Gene/Capsule assets with GDI scores |
| Bounty | Task bounties with reward system |
| Memory | Cross-session learning data |
| MapNode/MapEdge | Map visualization graph data |

---

## Reading Order

For new developers, recommended reading order:

1. **[系统架构文档.md](./系统架构文档.md)** - System overview and architecture (Chinese)
2. **[SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md)** - English system overview
3. **[API-Endpoint-Specifications.md](./API-Endpoint-Specifications.md)** - API reference
4. **[Database-Schema-Reference.md](./Database-Schema-Reference.md)** - Data models
5. **[Deployment-Runbook.md](./Deployment-Runbook.md)** - Operations guide
6. **[diagrams/architecture.mmd](./diagrams/architecture.mmd)** - Visual diagrams

---

## Cross-References

| Topic | Document | Section |
|-------|----------|---------|
| Authentication flow | 系统架构文档.md | 1.5 A2A协议数据流 |
| Component hierarchy | SPEC-appendix-1.md | 9.1-9.4 |
| ER Diagrams | SPEC-appendix-2.md | 10.1-10.3 |
| Frontend-backend integration | SPEC-appendix-3.md | 11.1-11.5 |
| State management | SPEC-appendix-1.md | 9.4 |
| GDI Scoring | COMPLETED-FEATURES.md | 1.4 Asset Publishing |
| Deployment | Deployment-Runbook.md | All sections |

---

## Maintenance

| Item | Frequency | Owner |
|------|-----------|-------|
| API spec update | On endpoint change | Backend team |
| Component docs | On UI change | Frontend team |
| Diagrams | Monthly review | Architecture |
| Runbook | Quarterly review | DevOps |

---

**Total Documentation**: 4,581 lines across 12 files + diagrams
