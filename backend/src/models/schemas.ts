import { z } from 'zod';

// User Registration
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// User Login
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// A2A Hello (Node Registration)
export const a2aHelloSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  capabilities: z.array(z.string()).default([]),
  version: z.string().optional(),
  endpoint: z.string().url('Invalid endpoint URL').optional(),
});

// A2A Heartbeat
export const a2aHeartbeatSchema = z.object({
  node_id: z.string(),
  status: z.enum(['active', 'busy', 'idle']),
  active_tasks: z.array(z.string()).default([]),
  load: z.number().min(0).max(1).optional(),
});

// Asset Publish
export const assetPublishSchema = z.object({
  type: z.enum(['gene', 'capsule']),
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  content: z.object({
    dna: z.string().optional(),
    prompt: z.string().optional(),
    tools: z.array(z.string()).default([]),
    model: z.string().optional(),
  }),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags').default([]),
  license: z.enum(['MIT', 'Apache-2.0', 'GPL-3.0', 'CLOSED']).default('MIT'),
  parent_id: z.string().uuid().optional(),
});

// Asset Fetch/Search
export const assetFetchSchema = z.object({
  // Primary query field (Evolver client uses 'keyword', others use 'query')
  query: z.string().optional(),
  keyword: z.string().optional(),
  type: z.enum(['gene', 'capsule']).optional(),
  tags: z.array(z.string()).optional(),
  sort: z.enum(['recent', 'popular', 'gdi']).default('recent'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  // Aliases for type filter
  asset_type: z.string().optional(),
});

// Bounty Create
export const bountyCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(10, 'Description too short').max(5000, 'Description too long'),
  requirements: z.string().max(2000).optional(),
  reward: z.number().positive('Reward must be positive'),
  expires_in_days: z.number().min(1).max(90).default(30),
});

// Bounty Claim
export const bountyClaimSchema = z.object({
  bounty_id: z.string(),
});

// Bounty Deliverable Submit
export const bountyDeliverableSchema = z.object({
  deliverable: z.string().min(1, 'Deliverable is required'),
  feedback: z.string().max(1000).optional(),
});

// Memory Store
export const memoryStoreSchema = z.object({
  type: z.enum(['fact', 'skill', 'experience', 'rule']),
  content: z.string().min(1, 'Content is required'),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Types export
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type A2AHelloInput = z.infer<typeof a2aHelloSchema>;
export type A2AHeartbeatInput = z.infer<typeof a2aHeartbeatSchema>;
export type AssetPublishInput = z.infer<typeof assetPublishSchema>;
export type AssetFetchInput = z.infer<typeof assetFetchSchema>;
export type BountyCreateInput = z.infer<typeof bountyCreateSchema>;
export type BountyClaimInput = z.infer<typeof bountyClaimSchema>;
export type BountyDeliverableInput = z.infer<typeof bountyDeliverableSchema>;
export type MemoryStoreInput = z.infer<typeof memoryStoreSchema>;
