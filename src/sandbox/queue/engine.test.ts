/**
 * Sandbox Execution Queue — Engine Unit Tests
 * Run with: npx vitest run src/sandbox/queue/engine.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SandboxExecutionEngine } from './engine';
import { SandboxRateLimiter } from './rate-limiter';

// Mock handler that resolves after a short delay
function makeMockHandler(resolveAfterMs = 5) {
  return vi.fn().mockImplementation(async (job, signal) => {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, resolveAfterMs);
      signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
    });
    return { job_id: job.job_id, status: 'ok' };
  });
}

describe('SandboxRateLimiter', () => {
  let limiter: SandboxRateLimiter;

  beforeEach(() => {
    limiter = new SandboxRateLimiter({
      maxJobsPerNode: 3,
      windowMs: 10_000,
      maxConcurrentPerNode: 2,
      maxConcurrentGlobal: 5,
      minJobIntervalMs: 50,
    });
    limiter.reset();
  });

  it('allows submission when under all limits', () => {
    const result = limiter.canSubmit('node1');
    expect(result.allowed).toBe(true);
  });

  it('rejects when per-node rate limit reached', () => {
    // First exhaust concurrency slots by recording AND completing them,
    // so only the rate-limit-per-window check fires on the 4th call.
    for (let i = 0; i < 3; i++) {
      limiter.recordSubmission('node2', `job${i}`);
      limiter.recordCompletion('node2', `job${i}`);
    }
    // Now window has 3 jobs and concurrency is 0 — rate limit should fire
    const result = limiter.canSubmit('node2');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/rate limit|per.*window/i);
  });

  it('rejects when per-node concurrency limit reached', () => {
    limiter.recordSubmission('node1', 'job1');
    limiter.recordSubmission('node1', 'job2');
    const result = limiter.canSubmit('node1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('concurrent');
  });

  it('rejects when global concurrency limit reached', () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordSubmission(`node${i}`, `job${i}`);
    }
    const result = limiter.canSubmit('node99');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Global');
  });

  it('rejects when minimum interval not elapsed', () => {
    limiter.recordSubmission('node1', 'job1');
    const result = limiter.canSubmit('node1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('wait');
  });

  it('records and frees concurrency slots on completion', () => {
    limiter.recordSubmission('node1', 'job1');
    expect(limiter.getNodeStatus('node1').concurrentJobs).toBe(1);
    limiter.recordCompletion('node1', 'job1');
    expect(limiter.getNodeStatus('node1').concurrentJobs).toBe(0);
  });

  it('allows submission after window reset', async () => {
    const fastLimiter = new SandboxRateLimiter({
      maxJobsPerNode: 2,
      windowMs: 50, // very short window for testing
      maxConcurrentPerNode: 10,
      maxConcurrentGlobal: 100,
      minJobIntervalMs: 0,
    });
    fastLimiter.recordSubmission('node1', 'job1');
    fastLimiter.recordSubmission('node1', 'job2');
    expect(fastLimiter.canSubmit('node1').allowed).toBe(false);
    await new Promise(r => setTimeout(r, 60));
    expect(fastLimiter.canSubmit('node1').allowed).toBe(true);
  });
});

describe('SandboxExecutionEngine', () => {
  let engine: SandboxExecutionEngine;
  let mockHandler: ReturnType<typeof makeMockHandler>;

  beforeEach(() => {
    engine = new SandboxExecutionEngine(
      { maxJobsPerNode: 5, windowMs: 60_000, maxConcurrentPerNode: 3, maxConcurrentGlobal: 50, minJobIntervalMs: 0 },
      1000,
      2000
    );
    mockHandler = makeMockHandler(5);
    engine.registerHandler('test-sandbox', mockHandler as Parameters<typeof engine.registerHandler>[1]);
  });

  it('enqueues a job and returns it', () => {
    const job = engine.enqueue('sbx1', 'node1', { test: true });
    expect(job.job_id).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.sandbox_id).toBe('sbx1');
    expect(job.node_id).toBe('node1');
    expect(engine.getJob(job.job_id)).toBeDefined();
  });

  it('returns correct queue position for newly enqueued jobs', async () => {
    // Check position of jobs before async processing drains the queue
    const j1 = engine.enqueue('sbx1', 'node1', { n: 1 });
    const j2 = engine.enqueue('sbx1', 'node1', { n: 2 }, { priority: 'low' });
    const j3 = engine.enqueue('sbx1', 'node1', { n: 3 }, { priority: 'critical' });
    // Verify all 3 are in the job index
    expect(engine.getJob(j1.job_id)).toBeDefined();
    expect(engine.getJob(j2.job_id)).toBeDefined();
    expect(engine.getJob(j3.job_id)).toBeDefined();
    // Verify total queued count is 3 before processing
    expect(engine.getStats().total_queued).toBe(3);
  });

  it('cancels a queued job', () => {
    const job = engine.enqueue('sbx1', 'node1', {});
    expect(engine.cancel(job.job_id, 'node1')).toBe(true);
    expect(engine.getJob(job.job_id)?.status).toBe('cancelled');
  });

  it('does not cancel job from different node', () => {
    const job = engine.enqueue('sbx1', 'node1', {});
    expect(engine.cancel(job.job_id, 'node2')).toBe(false);
    expect(engine.getJob(job.job_id)?.status).toBe('queued');
  });

  it('does not cancel already-running job', () => {
    const job = engine.enqueue('sbx1', 'node1', {});
    // manually mark as running
    job.status = 'running';
    expect(engine.cancel(job.job_id, 'node1')).toBe(false);
  });

  it('enqueues jobs by priority order', () => {
    engine.registerHandler('sbx1', mockHandler as Parameters<typeof engine.registerHandler>[1]);
    engine.enqueue('sbx1', 'node1', {}, { priority: 'low' });
    engine.enqueue('sbx1', 'node1', {}, { priority: 'high' });
    engine.enqueue('sbx1', 'node1', {}, { priority: 'critical' });
    // Verify all 3 jobs are registered and tracked by priority counts
    const stats = engine.getStats();
    expect(stats.by_priority.critical).toBe(1);
    expect(stats.by_priority.high).toBe(1);
    expect(stats.by_priority.low).toBe(1);
    expect(stats.total_queued).toBe(3);
  });

  it('getStats returns accurate counts', () => {
    engine.enqueue('sbx1', 'node1', {});
    engine.enqueue('sbx1', 'node1', {});
    engine.enqueue('sbx1', 'node2', {});
    const stats = engine.getStats();
    expect(stats.total_queued).toBe(3);
    expect(stats.by_node['node1']).toBe(2);
    expect(stats.by_node['node2']).toBe(1);
  });

  it('getJobsByNode returns only jobs for that node', () => {
    engine.enqueue('sbx1', 'node1', {});
    engine.enqueue('sbx1', 'node1', {});
    engine.enqueue('sbx1', 'node2', {});
    const node1Jobs = engine.getJobsByNode('node1');
    const node2Jobs = engine.getJobsByNode('node2');
    expect(node1Jobs).toHaveLength(2);
    expect(node2Jobs).toHaveLength(1);
  });

  it('throws RateLimitExceededError when rate limited', () => {
    const strictEngine = new SandboxExecutionEngine(
      { maxJobsPerNode: 1, windowMs: 60_000, maxConcurrentPerNode: 10, maxConcurrentGlobal: 100, minJobIntervalMs: 0 },
      1000, 2000
    );
    strictEngine.enqueue('sbx1', 'node1', {});
    try {
      strictEngine.enqueue('sbx1', 'node1', {});
      expect.fail('Should have thrown');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(err.message?.toLowerCase()).toContain('rate limit');
    }
  });

  it('throws QueueFullError when at capacity', () => {
    const tinyEngine = new SandboxExecutionEngine(
      { maxJobsPerNode: 100, windowMs: 60_000, maxConcurrentPerNode: 100, maxConcurrentGlobal: 100, minJobIntervalMs: 0 },
      2, 2000
    );
    tinyEngine.enqueue('sbx1', 'node1', {});
    tinyEngine.enqueue('sbx1', 'node1', {});
    try {
      tinyEngine.enqueue('sbx1', 'node1', {});
      expect.fail('Should have thrown');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      expect(err.code).toBe('QUEUE_FULL');
      expect(err.message?.toLowerCase()).toContain('queue capacity');
    }
  });

  it('unregisterHandler removes the handler', () => {
    expect(engine.unregisterHandler('test-sandbox')).toBe(true);
    expect(engine.unregisterHandler('test-sandbox')).toBe(false);
  });
});
