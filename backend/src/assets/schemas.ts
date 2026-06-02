// zod schemas for the GEP asset marketplace.
// These are the single source of truth for request validation.
import { z } from 'zod';

export const GepAssetTypeSchema = z.enum(['Gene', 'Capsule', 'Recipe']);
export const RecipeStepKindSchema = z.enum(['prompt', 'tool_call', 'http', 'note']);

// Recipe step schema
export const RecipeStepInputSchema = z.object({
  order: z.number().int().min(1),
  kind: RecipeStepKindSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  metadata: z.record(z.unknown()).optional(),
});
export type RecipeStepInput = z.infer<typeof RecipeStepInputSchema>;

// Create asset
export const CreateAssetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5_000).optional(),
  type: GepAssetTypeSchema,
  kind: z.string().max(50).optional(),
  content: z.string().max(100_000).optional(),
  url: z.string().url().max(2_000).optional(),
  metadata: z.record(z.unknown()).optional(),
  price: z.number().min(0).max(1_000_000).optional(),
  nodeId: z.string().uuid().optional(),
});
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;

// Update asset
export const UpdateAssetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
  kind: z.string().max(50).optional(),
  content: z.string().max(100_000).optional(),
  url: z.string().url().max(2_000).optional(),
  metadata: z.record(z.unknown()).optional(),
  price: z.number().min(0).max(1_000_000).optional(),
});
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;

// Publish asset (creates a new version)
export const PublishAssetSchema = z
  .object({
    changelog: z.string().max(2_000).optional(),
    steps: z.array(RecipeStepInputSchema).max(500).optional(),
  })
  .refine(
    (v) => v.steps === undefined || v.steps.length === 0 || v.steps.every((s, i) => s.order === i + 1),
    { message: 'Recipe steps must be contiguous 1..N ordering', path: ['steps'] }
  );
export type PublishAssetInput = z.infer<typeof PublishAssetSchema>;

// Rating
export const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2_000).optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

// Purchase
export const PurchaseAssetSchema = z.object({
  idempotencyKey: z.string().min(8).max(200).optional(),
});
export type PurchaseAssetInput = z.infer<typeof PurchaseAssetSchema>;

// List query
export const ListAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: GepAssetTypeSchema.optional(),
  status: z.enum(['draft', 'published', 'recycled']).optional(),
  authorId: z.string().optional(),
  nodeId: z.string().optional(),
  q: z.string().min(1).max(200).optional(),
});
export type ListAssetsQuery = z.infer<typeof ListAssetsQuerySchema>;
