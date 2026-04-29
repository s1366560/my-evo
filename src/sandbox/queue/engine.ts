/**
 * Sandbox Execution Queue — Execution Engine
 *
 * Manages the job queue lifecycle: enqueue, dequeue, run, timeout, retry.
 * Single Active instance for the sandbox queue.
 */

import type {
  QueueJob,
  JobStatus,
  JobPriority,
  ExecutionResult,
  ExecutionHandler,
  QueueStats,
  RateLimitConfig,
} from './types';
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  PRIORITY_WEIGHTS,
} from './types';
import { SandboxRateLimiter } from './rate-limiter';
import { AppError } from '../../shared/errors';

export class SandboxExecutionError extends AppError {
  constructor(
    message: string,
    public jobId: string,
    public sandboxId: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'SANDBOX_EXECUTION_ERROR', 500, details);
    this.name = 'SandboxExecutionError';
  }
}

export class QueueFullError extends AppError {
  constructor(message = 'Execution queue is full') {
    super(message, 'QUEUE_FULL', 503);
    this.name = 'QueueFullError';
  }
}

export class RateLimitExceededError extends AppError {
  constructor(
    message: string,
    public retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitExceededError';
  }
}

interface RunningJob {
  job: QueueJob;
  startedAt: Date;
  timeoutTimer: ReturnType<typeof setTimeout>;
  abortController: AbortController;
}

const MAX_QUEUE_SIZE = 10_000;

export class SandboxExecutionEngine {
  private readonly rateLimiter: SandboxRateLimiter;
  private readonly queue: QueueJob[] = [];
  private readonly running = new Map<string, RunningJob>(); // job_id -> running job
  private readonly jobIndex = new Map<string, QueueJob>(); // job_id -> job (all jobs)
  private isProcessing = false;
  private readonly maxQueueSize: number;
  private readonly defaultTimeoutMs: number;

  constructor(
    rateLimitConfig?: Partial<RateLimitConfig>,
    maxQueueSize = MAX_QUEUE_SIZE,
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS
  ) {
    this.rateLimiter = new SandboxRateLimiter(rateLimitConfig);
    this.maxQueueSize = maxQueueSize;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Enqueue a new sandbox execution job.
   * Validates rate limits and enqueues the job in priority order.
   */
  enqueue<T>(
    sandboxId: string,
    nodeId: string,
    payload: T,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      timeoutMs?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): QueueJob {
    const { priority = 'normal', maxRetries = DEFAULT_MAX_RETRIES, timeoutMs, metadata } = options;

    // ── Rate limit check ───────────────────────────────────────────────────────
    const limitCheck = this.rateLimiter.canSubmit(nodeId);
    if (!limitCheck.allowed) {
      throw new RateLimitExceededError(
        limitCheck.reason ?? 'Rate limit exceeded',
        limitCheck.retryAfterMs
      );
    }

    // ── Queue size check ───────────────────────────────────────────────────────
    if (this.queue.length >= this.maxQueueSize) {
      throw new QueueFullError(`Queue capacity reached (${this.maxQueueSize})`);
    }

    // ── Build job ──────────────────────────────────────────────────────────────
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + (timeoutMs ?? this.defaultTimeoutMs) * (maxRetries + 1));

    const job: QueueJob = {
      job_id: jobId,
      sandbox_id: sandboxId,
      node_id: nodeId,
      payload,
      priority,
      status: 'queued',
      created_at: new Date(),
      expires_at: expiresAt,
      max_retries: maxRetries,
      retry_count: 0,
      metadata,
    };

    // ── Register in index ───────────────────────────────────────────────────────
    this.jobIndex.set(jobId, job);

    // ── Insert in priority order ────────────────────────────────────────────────
    const insertIndex = this.findInsertIndex(job);
    this.queue.splice(insertIndex, 0, job);

    // Record submission in rate limiter
    this.rateLimiter.recordSubmission(nodeId, jobId);

    // ── Trigger processing if not already running ───────────────────────────────
    this.scheduleProcessing();

    return job;
  }

  /**
   * Cancel a queued job before it starts.
   * Returns false if the job already started or doesn't exist.
   */
  cancel(jobId: string, nodeId: string): boolean {
    const job = this.jobIndex.get(jobId);
    if (!job) return false;
    if (job.node_id !== nodeId) return false;
    if (job.status !== 'queued') return false;

    job.status = 'cancelled';

    const queueIndex = this.queue.findIndex(j => j.job_id === jobId);
    if (queueIndex !== -1) this.queue.splice(queueIndex, 1);

    this.rateLimiter.recordCompletion(nodeId, jobId);
    return true;
  }

  /**
   * Get a job by ID.
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobIndex.get(jobId);
  }

  /**
   * Get all jobs for a node.
   */
  getJobsByNode(nodeId: string): QueueJob[] {
    return Array.from(this.jobIndex.values()).filter(j => j.node_id === nodeId);
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    const jobs = Array.from(this.jobIndex.values());
    const byPriority = { low: 0, normal: 0, high: 0, critical: 0 } as Record<JobPriority, number>;
    const byNode = new Map<string, number>();
    let oldestAgeMs = 0;

    for (const job of jobs) {
      byPriority[job.priority]++;

      byNode.set(job.node_id, (byNode.get(job.node_id) ?? 0) + 1);

      if (job.status === 'queued') {
        const ageMs = Date.now() - job.created_at.getTime();
        if (ageMs > oldestAgeMs) oldestAgeMs = ageMs;
      }
    }

    return {
      total_queued: this.queue.length,
      total_running: this.running.size,
      total_completed: jobs.filter(j => j.status === 'completed').length,
      total_failed: jobs.filter(j => j.status === 'failed').length,
      total_timeout: jobs.filter(j => j.status === 'timeout').length,
      total_cancelled: jobs.filter(j => j.status === 'cancelled').length,
      by_priority: byPriority,
      by_node: Object.fromEntries(byNode),
      oldest_job_age_ms: oldestAgeMs,
    };
  }

  // ── Internal processing methods ────────────────────────────────────────────

  /**
   * Find the insertion index for a job in the priority queue.
   * Jobs are sorted by: (priority_weight DESC, created_at ASC)
   */
  private findInsertIndex(job: QueueJob): number {
    const weight = PRIORITY_WEIGHTS[job.priority];
    const createdAt = job.created_at.getTime();

    for (let i = 0; i < this.queue.length; i++) {
      const existing = this.queue[i];
      const existingWeight = PRIORITY_WEIGHTS[existing.priority];
      if (weight > existingWeight) continue;
      if (weight === existingWeight && createdAt >= existing.created_at.getTime()) continue;
      return i;
    }
    return this.queue.length;
  }

  private scheduleProcessing(): void {
    if (this.isProcessing) return;
    // Use setImmediate / Promise microtask to avoid stack overflow on many jobs
    Promise.resolve().then(() => this.processNext());
  }

  private async processNext(): Promise<void> {
    this.isProcessing = true;
    try {
      const job = this.queue.shift();
      if (!job) {
        this.isProcessing = false;
        return;
      }

      const runningJob = await this.startJob(job);
      this.running.set(job.job_id, runningJob);

      // Continue processing if more jobs can run concurrently
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    } catch {
      // If an error occurs, just stop processing for now
    }
    this.isProcessing = false;
  }

  private async startJob(job: QueueJob): Promise<RunningJob> {
    const abortController = new AbortController();
    const startedAt = new Date();

    job.status = 'running';
    job.started_at = startedAt;

    const timeoutMs = job.metadata?.timeoutMs as number | undefined ?? this.defaultTimeoutMs;
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(job.job_id);
    }, timeoutMs);

    // Run the job
    this.executeJob(job, abortController.signal).catch(() => {
      // Error handled inside executeJob
    });

    return { job, startedAt, timeoutTimer, abortController };
  }

  private async executeJob(
    job: QueueJob,
    signal: AbortSignal
  ): Promise<void> {
    try {
      // Get the handler registered for this sandbox/job type
      const handler = this.getHandler(job.sandbox_id);
      if (!handler) {
        throw new SandboxExecutionError(
          `No execution handler registered for sandbox '${job.sandbox_id}'`,
          job.job_id,
          job.sandbox_id
        );
      }

      const result = await handler(job, signal);

      // Job completed successfully
      this.finalizeJob(job.job_id, 'completed', result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      if (signal.aborted) {
        // Job was cancelled externally
        this.finalizeJob(job.job_id, 'cancelled', undefined, error);
      } else {
        // Job failed — check retry
        this.handleJobFailure(job, error);
      }
    }
  }

  private handleJobFailure(job: QueueJob, error: string): void {
    if (job.retry_count < job.max_retries) {
      // Re-enqueue with incremented retry count
      job.retry_count++;
      job.status = 'queued';
      job.error = error;

      const insertIndex = this.findInsertIndex(job);
      this.queue.splice(insertIndex, 0, job);
      this.scheduleProcessing();
    } else {
      this.finalizeJob(job.job_id, 'failed', undefined, error);
    }
  }

  private handleTimeout(jobId: string): void {
    const runningJob = this.running.get(jobId);
    if (!runningJob) return;

    // Abort the running job
    runningJob.abortController.abort();
    clearTimeout(runningJob.timeoutTimer);

    const job = this.jobIndex.get(jobId);
    if (job) {
      job.status = 'timeout';
      job.error = `Job timed out after ${this.defaultTimeoutMs}ms`;
    }

    this.running.delete(jobId);
    if (job) {
      this.rateLimiter.recordCompletion(job.node_id, jobId);
    }
  }

  private finalizeJob(
    jobId: string,
    status: 'completed' | 'failed' | 'cancelled',
    _result?: unknown,
    error?: string
  ): void {
    const runningJob = this.running.get(jobId);
    if (runningJob) {
      clearTimeout(runningJob.timeoutTimer);
      this.running.delete(jobId);
    }

    const job = this.jobIndex.get(jobId);
    if (job) {
      job.status = status;
      job.completed_at = new Date();
      if (error) job.error = error;
      this.rateLimiter.recordCompletion(job.node_id, jobId);
    }

    // Process next job
    this.scheduleProcessing();
  }

  private readonly _handlers = new Map<string, ExecutionHandler>();

  private getHandler(sandboxId: string): ExecutionHandler | undefined {
    return this._handlers.get(sandboxId);
  }

  /**
   * Register an execution handler for a sandbox.
   */
  registerHandler(sandboxId: string, handler: ExecutionHandler): void {
    this._handlers.set(sandboxId, handler);
  }

  /**
   * Unregister a handler for a sandbox.
   */
  unregisterHandler(sandboxId: string): boolean {
    return this._handlers.delete(sandboxId);
  }

  /**
   * Get the queue position of a job (0-indexed), or -1 if not queued.
   */
  getQueuePosition(jobId: string): number {
    return this.queue.findIndex(j => j.job_id === jobId);
  }

  /**
   * Expose the rate limiter for route inspection.
   */
  getRateLimiter(): SandboxRateLimiter {
    return this.rateLimiter;
  }
}
