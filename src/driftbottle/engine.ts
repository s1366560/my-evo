/**
 * Drift Bottle Engine
 * Chapter 13: Anonymous Signal Mechanism
 *
 * In-memory store for anonymous bottle exchange.
 * Integration points:
 *   - Credit system (reward transfer on resolution)
 *   - Asset system (applied_genes stored as Capsule references)
 */

import { randomUUID } from 'crypto';
import {
  DriftBottle,
  BottleRescue,
  BottleSummary,
  BottleStatus,
  ThrowBottleRequest,
  BottleFilter,
  RescueBottleRequest,
} from './types';

// ============ In-Memory Stores ============
const bottles = new Map<string, DriftBottle>();
const rescues = new Map<string, BottleRescue>();
const nodeBottleCount = new Map<string, number>(); // sender -> count (for anonymization tier)

// Config
const DEFAULT_REWARD = 50;
const DEFAULT_TTL_HOURS = 72;
const MAX_CONTENT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_BOTTLES_PER_NODE = 10; // Anti-spam

// ============ Bottle Lifecycle ============

/**
 * Throw a new drift bottle into the sea
 */
export function throwBottle(
  senderId: string,
  req: ThrowBottleRequest
): { bottle: DriftBottle; error?: string } {
  // Validate
  if (!req.title || req.title.trim().length === 0) {
    return { bottle: null as any, error: 'Title is required' };
  }
  if (req.title.length > MAX_TITLE_LENGTH) {
    return { bottle: null as any, error: `Title must be <= ${MAX_TITLE_LENGTH} chars` };
  }
  if (!req.content || req.content.trim().length === 0) {
    return { bottle: null as any, error: 'Content is required' };
  }
  if (req.content.length > MAX_CONTENT_LENGTH) {
    return { bottle: null as any, error: `Content must be <= ${MAX_CONTENT_LENGTH} chars` };
  }

  // Anti-spam: limit bottles per node
  const currentCount = nodeBottleCount.get(senderId) ?? 0;
  if (currentCount >= MAX_BOTTLES_PER_NODE) {
    return {
      bottle: null as any,
      error: `Rate limit: max ${MAX_BOTTLES_PER_NODE} bottles per node. Wait for resolution or expiration.`,
    };
  }

  const now = new Date();
  const ttlHours = req.ttl_hours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000);

  const bottle: DriftBottle = {
    bottle_id: `bottle_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    sender_id: senderId,
    signal_type: req.signal_type,
    title: req.title.trim(),
    content: req.content.trim(),
    tags: req.tags ?? [],
    reward: req.reward ?? DEFAULT_REWARD,
    status: 'floating',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  bottles.set(bottle.bottle_id, bottle);
  nodeBottleCount.set(senderId, currentCount + 1);

  return { bottle };
}

/**
 * Pick up a floating bottle (anonymous to sender)
 */
export function pickBottle(
  rescuerId: string,
  bottleId: string
): { rescue: BottleRescue; bottle: DriftBottle; error?: string } {
  const bottle = bottles.get(bottleId);
  if (!bottle) {
    return { rescue: null as any, bottle: null as any, error: 'Bottle not found' };
  }
  if (bottle.status !== 'floating') {
    return { rescue: null as any, bottle: null as any, error: `Bottle is ${bottle.status}, not available` };
  }
  if (bottle.sender_id === rescuerId) {
    return { rescue: null as any, bottle: null as any, error: 'Cannot pick your own bottle' };
  }

  // Check expiration
  if (new Date() > new Date(bottle.expires_at)) {
    bottle.status = 'expired';
    return { rescue: null as any, bottle, error: 'Bottle has expired' };
  }

  // Create rescue record
  const rescue: BottleRescue = {
    rescue_id: `rescue_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    bottle_id: bottleId,
    rescuer_id: rescuerId,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Update bottle
  bottle.status = 'picked';
  bottle.picked_at = new Date().toISOString();
  bottle.picked_by = rescuerId;

  rescues.set(rescue.rescue_id, rescue);
  return { rescue, bottle };
}

/**
 * Submit resolution for a picked bottle
 */
export function resolveBottle(
  rescuerId: string,
  req: RescueBottleRequest
): { rescue: BottleRescue; bottle: DriftBottle; error?: string } {
  const bottle = bottles.get(req.bottle_id);
  if (!bottle) {
    return { rescue: null as any, bottle: null as any, error: 'Bottle not found' };
  }
  if (bottle.status !== 'picked') {
    return { rescue: null as any, bottle: null as any, error: `Bottle is ${bottle.status}, cannot resolve` };
  }
  if (bottle.picked_by !== rescuerId) {
    return { rescue: null as any, bottle: null as any, error: 'Only the picker can resolve' };
  }
  if (!req.proposed_solution || req.proposed_solution.trim().length === 0) {
    return { rescue: null as any, bottle: null as any, error: 'Proposed solution is required' };
  }

  // Find the rescue record
  const rescue = [...rescues.values()].find(
    r => r.bottle_id === req.bottle_id && r.rescuer_id === rescuerId
  );
  if (!rescue) {
    return { rescue: null as any, bottle: null as any, error: 'Rescue record not found' };
  }

  // Update rescue
  rescue.status = 'completed';
  rescue.proposed_solution = req.proposed_solution.trim();
  rescue.applied_genes = req.applied_genes ?? [];
  rescue.resolved_at = new Date().toISOString();

  // Update bottle
  bottle.status = 'resolved';
  bottle.resolved_at = new Date().toISOString();
  bottle.resolution = req.proposed_solution.trim();

  // Decay sender bottle count (bottle resolved, freeing up quota)
  const currentCount = nodeBottleCount.get(bottle.sender_id) ?? 0;
  nodeBottleCount.set(bottle.sender_id, Math.max(0, currentCount - 1));

  return { rescue, bottle };
}

/**
 * Reject/abandon a picked bottle
 */
export function rejectBottle(
  rescuerId: string,
  bottleId: string
): { bottle: DriftBottle; error?: string } {
  const bottle = bottles.get(bottleId);
  if (!bottle) {
    return { bottle: null as any, error: 'Bottle not found' };
  }
  if (bottle.status !== 'picked') {
    return { bottle: null as any, error: `Bottle is ${bottle.status}` };
  }
  if (bottle.picked_by !== rescuerId) {
    return { bottle: null as any, error: 'Only the picker can reject' };
  }

  // Reset bottle to floating
  bottle.status = 'floating';
  bottle.picked_at = undefined;
  bottle.picked_by = undefined;

  // Mark rescue as rejected
  const rescue = [...rescues.values()].find(
    r => r.bottle_id === bottleId && r.rescuer_id === rescuerId
  );
  if (rescue) {
    rescue.status = 'rejected';
    rescue.resolved_at = new Date().toISOString();
  }

  return { bottle };
}

// ============ Getters ============

export function getBottle(bottleId: string): DriftBottle | undefined {
  return bottles.get(bottleId);
}

/**
 * Get bottle summary (hides identities)
 */
export function getBottleSummary(bottleId: string): BottleSummary | undefined {
  const bottle = bottles.get(bottleId);
  if (!bottle) return undefined;
  return toSummary(bottle);
}

export function getRescue(rescueId: string): BottleRescue | undefined {
  return rescues.get(rescueId);
}

/**
 * List bottles with optional filters (returns summaries)
 */
export function listBottles(filter?: BottleFilter): BottleSummary[] {
  let result = [...bottles.values()];

  // Auto-expire check
  const now = new Date();
  for (const bottle of result) {
    if (bottle.status === 'floating' && new Date(bottle.expires_at) < now) {
      bottle.status = 'expired';
    }
  }

  // Default to floating only (unless explicitly filtered)
  if (filter?.status) {
    result = result.filter(b => b.status === filter.status);
  } else {
    result = result.filter(b => b.status === 'floating');
  }
  if (filter?.signal_type) {
    result = result.filter(b => b.signal_type === filter.signal_type);
  }
  if (filter?.tags && filter.tags.length > 0) {
    result = result.filter(b =>
      filter.tags!.some(tag => b.tags.includes(tag))
    );
  }
  if (filter?.min_reward !== undefined) {
    result = result.filter(b => b.reward >= filter.min_reward!);
  }

  // Sort: floating first, then by created_at desc
  result.sort((a, b) => {
    if (a.status === 'floating' && b.status !== 'floating') return -1;
    if (a.status !== 'floating' && b.status === 'floating') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? 20;
  return result.slice(offset, offset + limit).map(toSummary);
}

/**
 * Get bottles by rescuer (for inbox view)
 */
export function getRescuerInbox(rescuerId: string): Array<{
  bottle: DriftBottle;
  rescue: BottleRescue;
}> {
  return [...rescues.values()]
    .filter(r => r.rescuer_id === rescuerId && r.status === 'pending')
    .map(rescue => {
      const bottle = bottles.get(rescue.bottle_id);
      return bottle ? { bottle, rescue } : null;
    })
    .filter(Boolean) as any;
}

/**
 * Get bottle statistics
 */
export function getBottleStats(): {
  total: number;
  floating: number;
  picked: number;
  resolved: number;
  expired: number;
} {
  // Auto-expire
  const now = new Date();
  for (const bottle of bottles.values()) {
    if (bottle.status === 'floating' && new Date(bottle.expires_at) < now) {
      bottle.status = 'expired';
    }
  }

  const all = [...bottles.values()];
  return {
    total: all.length,
    floating: all.filter(b => b.status === 'floating').length,
    picked: all.filter(b => b.status === 'picked').length,
    resolved: all.filter(b => b.status === 'resolved').length,
    expired: all.filter(b => b.status === 'expired').length,
  };
}

// ============ Helpers ============

function toSummary(bottle: DriftBottle): BottleSummary {
  return {
    bottle_id: bottle.bottle_id,
    signal_type: bottle.signal_type,
    title: bottle.title,
    tags: bottle.tags,
    reward: bottle.reward,
    status: bottle.status,
    created_at: bottle.created_at,
    expires_at: bottle.expires_at,
    picked: bottle.status === 'picked' || bottle.status === 'resolved',
    resolved: bottle.status === 'resolved',
  };
}

// ============ Test Helpers ============
export function resetStores(): void {
  bottles.clear();
  rescues.clear();
  nodeBottleCount.clear();
}
