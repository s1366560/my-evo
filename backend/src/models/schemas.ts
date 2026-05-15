import { z } from 'zod';

// ============================================================
// Auth Schemas
// ============================================================
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================
// A2A / Node Schemas
// ============================================================
export const a2aHelloSchema = z.object({
  name: z.string().min(1, 'Node name is required'),
  description: z.string().optional().default(''),
  capabilities: z.array(z.string()).optional().default([]),
  version: z.string().optional(),
  endpoint: z.string().url().optional().or(z.string().max(0)).optional().default(''),
});

export const a2aHeartbeatSchema = z.object({
  nodeId: z.string().min(1, 'nodeId is required'),
  status: z.enum(['IDLE', 'BUSY', 'OFFLINE']).optional().default('IDLE'),
  load: z.number().min(0).max(1).optional(),
  activeTasks: z.number().int().min(0).optional(),
});

export const a2aNodeVerifySchema = z.object({
  nodeId: z.string().min(1, 'nodeId is required'),
  action: z.enum(['activate', 'deactivate', 'block']).optional().default('activate'),
});

// ============================================================
// Asset Schemas
// ============================================================
export const assetPublishSchema = z.object({
  type: z.enum(['GENE', 'CAPSULE']),
  name: z.string().min(1, 'Asset name is required'),
  description: z.string().optional().default(''),
  content: z.object({
    dna: z.string().optional().default(''),
    prompt: z.string().optional().default(''),
  }).optional().default({}),
  tools: z.array(z.string()).optional().default([]),
  model: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  license: z.enum(['MIT', 'APACHE_2', 'GPL_3', 'CLOSED']).optional().default('MIT'),
  parentId: z.string().optional(),
});

export const assetFetchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['GENE', 'CAPSULE']).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['PUBLISHED']).optional().default('PUBLISHED'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  sortBy: z.enum(['gdiScore', 'createdAt', 'name']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const assetReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// ============================================================
// Memory Schemas
// ============================================================
export const memoryStoreSchema = z.object({
  type: z.enum(['FACT', 'SKILL', 'EXPERIENCE', 'RULE']),
  content: z.string().min(1, 'Content is required'),
  embedding: z.array(z.number()).optional().default([]),
  metadata: z.record(z.any()).optional(),
});

export type MemoryStoreInput = z.infer<typeof memoryStoreSchema>;

// ============================================================
// Bounty Schemas
// ============================================================
export const bountyCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  requirements: z.string().optional().default(''),
  reward: z.number().positive('Reward must be positive'),
  expires_in_days: z.number().int().min(1).max(90).optional().default(30),
});

export const bountyClaimSchema = z.object({
  // claim endpoint uses params for bountyId, body can carry optional notes
  notes: z.string().optional(),
});

export const bountyDeliverableSchema = z.object({
  deliverable: z.string().min(1, 'Deliverable is required'),
  feedback: z.string().optional(),
});

export type BountyCreateInput = z.infer<typeof bountyCreateSchema>;
export type BountyClaimInput = z.infer<typeof bountyClaimSchema>;
export type BountyDeliverableInput = z.infer<typeof bountyDeliverableSchema>;

// ============================================================
// Map Schemas
// ============================================================
export const mapSaveSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    score: z.number().optional(),
    color: z.string().optional(),
    type: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    type: z.string().optional().default('reference'),
    strength: z.number().optional(),
    weight: z.number().optional(),
  })).optional(),
  config: z.record(z.any()).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

// ============================================================
// GDI Scoring Schemas
// ============================================================
export const gdiPreviewSchema = z.object({
  type: z.enum(['gene', 'capsule']),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  content: z.object({
    dna: z.string().optional().default(''),
    prompt: z.string().optional().default(''),
  }).optional().default({}),
  tools: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export const gdiScoreSchema = z.object({
  type: z.enum(['gene', 'capsule']),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  content: z.object({
    dna: z.string().optional().default(''),
    prompt: z.string().optional().default(''),
  }).optional().default({}),
  tools: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  nodeId: z.string().optional(),
});
