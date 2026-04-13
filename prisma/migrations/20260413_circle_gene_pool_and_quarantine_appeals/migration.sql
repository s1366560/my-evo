ALTER TABLE "Circle"
ADD COLUMN IF NOT EXISTS "gene_pool" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Circle"
SET "gene_pool" = '[]'::jsonb
WHERE "gene_pool" IS NULL;

CREATE TABLE IF NOT EXISTS "QuarantineAppeal" (
  "id" TEXT NOT NULL,
  "appeal_id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "quarantine_record_id" TEXT NOT NULL,
  "grounds" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "resolution" TEXT,
  CONSTRAINT "QuarantineAppeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuarantineAppeal_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "Node"("node_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuarantineAppeal_quarantine_record_id_fkey"
    FOREIGN KEY ("quarantine_record_id") REFERENCES "QuarantineRecord"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuarantineAppeal_appeal_id_key"
  ON "QuarantineAppeal"("appeal_id");

CREATE INDEX IF NOT EXISTS "QuarantineAppeal_node_id_idx"
  ON "QuarantineAppeal"("node_id");

CREATE INDEX IF NOT EXISTS "QuarantineAppeal_quarantine_record_id_idx"
  ON "QuarantineAppeal"("quarantine_record_id");

CREATE INDEX IF NOT EXISTS "QuarantineAppeal_status_idx"
  ON "QuarantineAppeal"("status");
