# My Evo 系统架构图 v2.0

> **版本**: 2.0 | **更新日期**: 2026-04-28

本文档使用 Mermaid 图表展示系统架构。

---

## 1. 系统整体架构

```mermaid
graph TB
    subgraph Client["客户端层"]
        Web[Web App<br/>React + TypeScript]
        Mobile[Mobile App<br/>React Native]
        Desktop[Desktop<br/>Tauri]
        API[API Client<br/>SDK]
    end

    subgraph Gateway["网关层"]
        CDN[Cloudflare<br/>CDN + WAF]
        LB[Load Balancer<br/>AWS ALB]
    end

    subgraph Services["服务层"]
        API_GW[API Gateway<br/>Express.js]
        
        WS[Workspace]
        GDI[GDI Service]
        GEP[GEP Service]
        SWARM[Swarm Service]
        WP[WorkerPool]
        SK[SkillStore]
        SUB[Subscription]
        
        AUTH[JWT Auth]
        PRISMA[Prisma]
    end

    subgraph Data["数据层"]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        S3[(S3 Assets)]
    end

    Client --> Gateway
    Gateway --> LB
    LB --> API_GW
    API_GW --> Services
    Services --> Data
```

---

## 2. 模块依赖关系

```mermaid
graph LR
    GW[API Gateway] --> WS[Workspace]
    GW --> AUTH[Auth]
    
    WS --> GDI[GDI评价]
    AUTH --> REP[Reputation]
    
    GDI --> SWARM[Swarm]
    REP --> SWARM
    
    SWARM --> WP[WorkerPool]
    SWARM --> SK[SkillStore]
    
    SK --> SUB[Subscription]
    
    SWARM --> COUNCIL[Council]
    WP --> COUNCIL
```

---

## 3. API 请求流程

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as Auth
    participant R as RateLimit
    participant H as Handler
    participant S as Service
    participant D as DB

    C->>G: API Request
    G->>A: Validate JWT
    A-->>G: Valid
    G->>R: Check Rate
    R-->>G: OK
    G->>H: Route
    H->>S: Call
    S->>D: Query
    D-->>S: Result
    S-->>H: Response
    H-->>G: Formatted
    G-->>C: JSON
```

---

## 4. GDI 评分流程

```mermaid
flowchart TD
    A[Asset Event] --> B{H Trigger?}
    B -->|Manual| C[User Request]
    B -->|Auto| D[Score Stale]
    B -->|Event| E[Vote/Download]
    
    C --> F[Queue Job]
    D --> F
    E --> F
    
    F --> G[Fetch Data]
    G --> H[Intrinsic Score]
    H --> I[Usage Score]
    I --> J[Social Score]
    J --> K[Aggregate]
    K --> L[Store Record]
```

---

*文档版本: v2.0 | 最后更新: 2026-04-28*
