-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'USER'
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "version" TEXT,
    "endpoint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reputation" REAL NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "credits" REAL NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME,
    CONSTRAINT "Node_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dna" TEXT,
    "prompt" TEXT,
    "tools" TEXT NOT NULL DEFAULT '[]',
    "model" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "license" TEXT NOT NULL DEFAULT 'MIT',
    "parentId" TEXT,
    "gdiScore" REAL NOT NULL DEFAULT 0,
    "gdiBreakdown" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "nodeId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Asset_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetReview_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeartbeatLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "load" REAL,
    "activeTasks" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeartbeatLog_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bountyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "reward" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Bounty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BountyClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bountyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliverable" TEXT,
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    CONSTRAINT "BountyClaim_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BountyClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MapNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapNodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" REAL NOT NULL,
    "positionY" REAL NOT NULL,
    "size" REAL NOT NULL DEFAULT 1,
    "color" TEXT,
    "metadata" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MapEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "ReputationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Node_nodeId_key" ON "Node"("nodeId");

-- CreateIndex
CREATE INDEX "Node_nodeId_idx" ON "Node"("nodeId");

-- CreateIndex
CREATE INDEX "Node_status_idx" ON "Node"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");

-- CreateIndex
CREATE INDEX "Asset_assetId_idx" ON "Asset"("assetId");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Asset_nodeId_idx" ON "Asset"("nodeId");

-- CreateIndex
CREATE INDEX "AssetReview_assetId_idx" ON "AssetReview"("assetId");

-- CreateIndex
CREATE INDEX "HeartbeatLog_nodeId_idx" ON "HeartbeatLog"("nodeId");

-- CreateIndex
CREATE INDEX "HeartbeatLog_createdAt_idx" ON "HeartbeatLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_bountyId_key" ON "Bounty"("bountyId");

-- CreateIndex
CREATE INDEX "Bounty_bountyId_idx" ON "Bounty"("bountyId");

-- CreateIndex
CREATE INDEX "Bounty_status_idx" ON "Bounty"("status");

-- CreateIndex
CREATE INDEX "Bounty_userId_idx" ON "Bounty"("userId");

-- CreateIndex
CREATE INDEX "BountyClaim_bountyId_idx" ON "BountyClaim"("bountyId");

-- CreateIndex
CREATE INDEX "BountyClaim_userId_idx" ON "BountyClaim"("userId");

-- CreateIndex
CREATE INDEX "Memory_nodeId_idx" ON "Memory"("nodeId");

-- CreateIndex
CREATE INDEX "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MapNode_mapNodeId_key" ON "MapNode"("mapNodeId");

-- CreateIndex
CREATE INDEX "MapNode_mapNodeId_idx" ON "MapNode"("mapNodeId");

-- CreateIndex
CREATE INDEX "MapEdge_sourceId_idx" ON "MapEdge"("sourceId");

-- CreateIndex
CREATE INDEX "MapEdge_targetId_idx" ON "MapEdge"("targetId");

-- CreateIndex
CREATE INDEX "ReputationLog_nodeId_idx" ON "ReputationLog"("nodeId");
