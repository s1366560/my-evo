/**
 * Sandbox Execution Queue — Rate Limiter
 *
 * Token-bucket + sliding-window rate limiter for sandbox job submissions.
 * Per-node limits and global limits enforced separately.
 */

import type { RateLimitConfig } from './types';
import { DEFAULT_RATE_LIMIT_CONFIG } from './types';

interface RateLimitRecord {
  count: number;
  windowStart: number;
  lastJobTime: number;
}

interface NodeConcurrencyRecord {
  slots: Set<string>; // job_ids currently running for this node
}

/**
 * In-memory rate limiter for sandbox job submissions.
 * Tracks per-node and global job counts and concurrency slots.
 */
export class SandboxRateLimiter {
  private readonly config: RateLimitConfig;
  private readonly nodeRecords = new Map<string, RateLimitRecord>();
  private readonly nodeConcurrency = new Map<string, NodeConcurrencyRecord>();
  private globalConcurrency = new Set<string>(); // job_ids
  private globalWindowCount = 0;
  private globalWindowStart = Date.now();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Check if a node can submit a new job (rate limit check).
   * Returns { allowed: true } or { allowed: false, reason: string, retryAfterMs: number }
   */
  canSubmit(nodeId: string): { allowed: boolean; reason?: string; retryAfterMs?: number } {
    const now = Date.now();

    // ── Global concurrency check ──────────────────────────────────────────────
    if (this.globalConcurrency.size >= this.config.maxConcurrentGlobal) {
      return {
        allowed: false,
        reason: 'Global execution concurrency limit reached',
        retryAfterMs: 5_000,
      };
    }

    // ── Per-node concurrency check ──────────────────────────────────────────
    const nodeConc = this.nodeConcurrency.get(nodeId);
    if (nodeConc && nodeConc.slots.size >= this.config.maxConcurrentPerNode) {
      return {
        allowed: false,
        reason: `Node '${nodeId}' has reached max concurrent executions (${this.config.maxConcurrentPerNode})`,
        retryAfterMs: 10_000,
      };
    }

    // ── Per-node rate limit window check ────────────────────────────────────
    const record = this.nodeRecords.get(nodeId) ?? {
      count: 0,
      windowStart: now,
      lastJobTime: 0,
    };

    const windowElapsed = now - record.windowStart;
    const withinWindow = windowElapsed < this.config.windowMs;

    if (withinWindow) {
      if (record.count >= this.config.maxJobsPerNode) {
        return {
          allowed: false,
          reason: `Node '${nodeId}' rate limit reached: ${this.config.maxJobsPerNode} jobs per ${this.config.windowMs}ms window`,
          retryAfterMs: this.config.windowMs - windowElapsed,
        };
      }
    } else {
      // Reset window
      record.count = 0;
      record.windowStart = now;
    }

    // ── Minimum interval check ──────────────────────────────────────────────
    const intervalSinceLast = now - record.lastJobTime;
    if (intervalSinceLast < this.config.minJobIntervalMs) {
      return {
        allowed: false,
        reason: `Node '${nodeId}' must wait ${this.config.minJobIntervalMs}ms between jobs`,
        retryAfterMs: this.config.minJobIntervalMs - intervalSinceLast,
      };
    }

    return { allowed: true };
  }

  /**
   * Record that a job has been accepted (increments counters, acquires concurrency slot).
   */
  recordSubmission(nodeId: string, jobId: string): void {
    const now = Date.now();

    // Update node record
    const record = this.nodeRecords.get(nodeId) ?? {
      count: 0,
      windowStart: now,
      lastJobTime: 0,
    };
    record.count += 1;
    record.lastJobTime = now;
    this.nodeRecords.set(nodeId, record);

    // Acquire per-node concurrency slot
    let nodeConc = this.nodeConcurrency.get(nodeId);
    if (!nodeConc) {
      nodeConc = { slots: new Set() };
      this.nodeConcurrency.set(nodeId, nodeConc);
    }
    nodeConc.slots.add(jobId);

    // Acquire global concurrency slot
    this.globalConcurrency.add(jobId);
  }

  /**
   * Record that a job has started execution (start time recorded in canSubmit logic above).
   * This is called when the job actually begins running after being dequeued.
   */
  recordStart(nodeId: string, jobId: string): void {
    // Already recorded in recordSubmission; this is for any additional start-time bookkeeping
  }

  /**
   * Record that a job has completed (frees concurrency slots).
   */
  recordCompletion(nodeId: string, jobId: string): void {
    // Free per-node slot
    const nodeConc = this.nodeConcurrency.get(nodeId);
    if (nodeConc) {
      nodeConc.slots.delete(jobId);
      if (nodeConc.slots.size === 0) {
        this.nodeConcurrency.delete(nodeId);
      }
    }

    // Free global slot
    this.globalConcurrency.delete(jobId);
  }

  /**
   * Get current rate limit status for a node.
   */
  getNodeStatus(nodeId: string): {
    currentCount: number;
    windowMs: number;
    windowResetMs: number;
    concurrentJobs: number;
    maxConcurrent: number;
  } {
    const now = Date.now();
    const record = this.nodeRecords.get(nodeId);
    const nodeConc = this.nodeConcurrency.get(nodeId);

    const windowElapsed = record ? now - record.windowStart : 0;
    const windowResetMs = Math.max(0, this.config.windowMs - windowElapsed);

    return {
      currentCount: record?.count ?? 0,
      windowMs: this.config.windowMs,
      windowResetMs,
      concurrentJobs: nodeConc?.slots.size ?? 0,
      maxConcurrent: this.config.maxConcurrentPerNode,
    };
  }

  /**
   * Get global rate limit status.
   */
  getGlobalStatus(): {
    globalConcurrent: number;
    maxGlobalConcurrent: number;
  } {
    return {
      globalConcurrent: this.globalConcurrency.size,
      maxGlobalConcurrent: this.config.maxConcurrentGlobal,
    };
  }

  /** Reset all rate limit state (useful for testing). */
  reset(): void {
    this.nodeRecords.clear();
    this.nodeConcurrency.clear();
    this.globalConcurrency.clear();
    this.globalWindowCount = 0;
    this.globalWindowStart = Date.now();
  }

  /** Clean up expired node records (records from windows that have long passed). */
  cleanupExpired(maxAgeMs = 300_000): number {
    const now = Date.now();
    let removed = 0;
    for (const [nodeId, record] of this.nodeRecords.entries()) {
      if (now - record.windowStart > maxAgeMs) {
        this.nodeRecords.delete(nodeId);
        removed++;
      }
    }
    return removed;
  }
}
