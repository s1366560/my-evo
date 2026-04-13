CREATE TABLE IF NOT EXISTS "KnowledgeGraphRelationship" (
  "id" TEXT NOT NULL,
  "relationship_id" TEXT NOT NULL,
  "from_id" TEXT NOT NULL,
  "to_id" TEXT NOT NULL,
  "relationship_type" TEXT NOT NULL,
  "properties" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeGraphRelationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeGraphRelationship_relationship_id_key"
  ON "KnowledgeGraphRelationship"("relationship_id");

CREATE INDEX IF NOT EXISTS "KnowledgeGraphRelationship_from_id_idx"
  ON "KnowledgeGraphRelationship"("from_id");

CREATE INDEX IF NOT EXISTS "KnowledgeGraphRelationship_to_id_idx"
  ON "KnowledgeGraphRelationship"("to_id");

CREATE INDEX IF NOT EXISTS "KnowledgeGraphRelationship_relationship_type_idx"
  ON "KnowledgeGraphRelationship"("relationship_type");
