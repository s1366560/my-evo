-- AlterTable
ALTER TABLE "User" ADD COLUMN "apiKey" TEXT;
ALTER TABLE "User" ADD COLUMN "apiKeyCreatedAt" DATETIME;

-- CreateTable
CREATE TABLE "SavedMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "nodes" TEXT NOT NULL DEFAULT '[]',
    "edges" TEXT NOT NULL DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SavedMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedMap_mapId_key" ON "SavedMap"("mapId");

-- CreateIndex
CREATE INDEX "SavedMap_mapId_idx" ON "SavedMap"("mapId");

-- CreateIndex
CREATE INDEX "SavedMap_userId_idx" ON "SavedMap"("userId");
