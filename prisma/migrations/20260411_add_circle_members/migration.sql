ALTER TABLE "Circle"
ADD COLUMN IF NOT EXISTS "members" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Circle"
SET "members" = jsonb_build_array("creator_id")
WHERE jsonb_array_length("members") = 0;

UPDATE "Dispute"
SET "type" = 'asset_quality'
WHERE "type" = 'ASSET_QUALITY';

UPDATE "Dispute"
SET "related_asset_id" = "target_id"
WHERE "type" IN ('asset_quality', 'ASSET_QUALITY')
  AND "related_asset_id" IS NULL
  AND "target_id" IS NOT NULL;
