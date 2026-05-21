# My Evo Backend API Endpoints

## Base URL
```
http://localhost:3001/api
```

## Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/me` | Get current user | Yes |
| POST | `/auth/apikey` | Create API key | Yes |

### Register
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "fullName": "Full Name"
}
```

### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "emailOrUsername": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "credits": 0,
      "reputation": 0
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 604800
    }
  }
}
```

---

## Map Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/maps` | Create map | Yes |
| GET | `/maps` | List user's maps | Yes |
| GET | `/maps/:id` | Get map details | Yes |
| PUT | `/maps/:id` | Update map | Yes |
| DELETE | `/maps/:id` | Delete map | Yes |
| POST | `/maps/:id/fork` | Fork a map | Yes |

### Create Map
```bash
POST /maps
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Evolution Map",
  "description": "A sample map",
  "layout": "force",
  "tags": "evolution,ai"
}
```

### List Maps
```bash
GET /maps?page=1&limit=20&search=keyword&isPublic=true
Authorization: Bearer <token>
```

---

## Node Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/maps/:mapId/nodes` | Create node | Yes |
| PUT | `/maps/:mapId/nodes/:nodeId` | Update node | Yes |
| DELETE | `/maps/:mapId/nodes/:nodeId` | Delete node | Yes |
| POST | `/maps/:mapId/nodes/bulk` | Bulk create nodes | Yes |

### Create Node
```bash
POST /maps/:mapId/nodes
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Concept A",
  "type": "concept",
  "positionX": 100,
  "positionY": 200,
  "color": "#3498db",
  "size": 1.5
}
```

---

## Edge Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/maps/:mapId/edges` | Create edge | Yes |
| PUT | `/maps/:mapId/edges/:edgeId` | Update edge | Yes |
| DELETE | `/maps/:mapId/edges/:edgeId` | Delete edge | Yes |
| POST | `/maps/:mapId/edges/bulk` | Bulk create edges | Yes |

### Create Edge
```bash
POST /maps/:mapId/edges
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceId": "node-uuid-1",
  "targetId": "node-uuid-2",
  "type": "dependency",
  "weight": 1
}
```

---

## Import/Export Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/maps/:id/export` | Export map as JSON | Yes |
| POST | `/maps/import` | Import map from JSON | Yes |

### Export Map
```bash
GET /maps/:id/export
Authorization: Bearer <token>
```

### Import Map
```bash
POST /maps/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Imported Map",
  "data": { /* exported map data */ }
}
```

---

## Graph Computation Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/graph/:mapId/metrics` | Get graph metrics | Yes |
| GET | `/graph/:mapId/nodes/:nodeId/metrics` | Get node metrics | Yes |
| GET | `/graph/:mapId/pagerank` | Calculate PageRank | Yes |
| GET | `/graph/:mapId/cycles` | Detect cycles | Yes |
| GET | `/graph/:mapId/path` | Find shortest path | Yes |
| GET | `/graph/:mapId/toposort` | Topological sort | Yes |

### Get Graph Metrics
```bash
GET /graph/:mapId/metrics
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "nodeCount": 10,
    "edgeCount": 15,
    "density": 0.33,
    "avgDegree": 3,
    "connectedComponents": 1,
    "isAcyclic": true,
    "levels": [2, 4, 3, 1]
  }
}
```

### Find Shortest Path
```bash
GET /graph/:mapId/path?source=node-uuid-1&target=node-uuid-2
Authorization: Bearer <token>
```

### Calculate PageRank
```bash
GET /graph/:mapId/pagerank?damping=0.85&iterations=100
Authorization: Bearer <token>
```

---

## Node Types
- `concept` - General concept or idea
- `agent` - AI agent or autonomous entity
- `action` - Action or task
- `resource` - Resource or capability
- `event` - Event or milestone
- `milestone` - Important milestone

## Edge Types
- `dependency` - Dependency relationship
- `association` - General association
- `composition` - Part-whole relationship
- `inheritance` - Inheritance/specialization
- `communication` - Communication flow

## Error Response Format
```json
{
  "success": false,
  "error": "Error message"
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
