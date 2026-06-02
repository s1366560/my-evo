-- AlterTable: add status/kind columns + publishedVersionId pointer to assets
ALTER TABLE "assets"
  ADD COLUMN "kind" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "publishedVersionId" TEXT;

-- CreateIndex for new asset columns
CREATE INDEX "assets_type_idx" ON "assets"("type");
CREATE INDEX "assets_status_idx" ON "assets"("status");
CREATE INDEX "assets_published_idx" ON "assets"("published");

-- CreateTable: asset_versions
CREATE TABLE "asset_versions" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "price" DOUBLE PRECISION,
    "authorId" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_versions_pkey" PRIMARY KEY ("id")
);

-- Unique compound key on (assetId, versionNo)
CREATE UNIQUE INDEX "asset_versions_assetId_versionNo_key" ON "asset_versions"("assetId", "versionNo");
CREATE INDEX "asset_versions_assetId_idx" ON "asset_versions"("assetId");

-- AddForeignKey for asset_versions
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: recipe_steps
CREATE TABLE "recipe_steps" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_steps_versionId_order_key" ON "recipe_steps"("versionId", "order");
CREATE INDEX "recipe_steps_versionId_idx" ON "recipe_steps"("versionId");

ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "asset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: asset_reviews
CREATE TABLE "asset_reviews" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_reviews_assetId_userId_key" ON "asset_reviews"("assetId", "userId");
CREATE INDEX "asset_reviews_assetId_idx" ON "asset_reviews"("assetId");
CREATE INDEX "asset_reviews_userId_idx" ON "asset_reviews"("userId");

ALTER TABLE "asset_reviews" ADD CONSTRAINT "asset_reviews_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_reviews" ADD CONSTRAINT "asset_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: asset_purchases (append-only transaction log)
CREATE TABLE "asset_purchases" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pricePaid" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_purchases_idempotencyKey_key" ON "asset_purchases"("idempotencyKey");
CREATE INDEX "asset_purchases_assetId_idx" ON "asset_purchases"("assetId");
CREATE INDEX "asset_purchases_userId_idx" ON "asset_purchases"("userId");
CREATE INDEX "asset_purchases_createdAt_idx" ON "asset_purchases"("createdAt");

ALTER TABLE "asset_purchases" ADD CONSTRAINT "asset_purchases_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_purchases" ADD CONSTRAINT "asset_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Finally wire assets.publishedVersionId -> asset_versions.id (must be after asset_versions exists)
ALTER TABLE "assets" ADD CONSTRAINT "assets_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "asset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "assets_publishedVersionId_key" ON "assets"("publishedVersionId");
