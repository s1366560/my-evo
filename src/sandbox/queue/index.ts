/**
 * Sandbox Execution Queue — Module Entry Point
 *
 * Exports the queue engine singleton and all submodules.
 */

import { SandboxExecutionEngine } from './engine';
import { SandboxRateLimiter } from './rate-limiter';
import type { RateLimitConfig, ExecutionHandler, QueueJob } from './types';
import { DEFAULT_RATE_LIMIT_CONFIG } from './types';

// Module-level singleton engine
let _engine: SandboxExecutionEngine | undefined;

/**
 * Get (or create) the sandbox execution engine singleton.
 * Call this from routes and app.ts to get the shared instance.
 */
export function getSandboxExecutionEngine(
  config?: Partial<RateLimitConfig>
): SandboxExecutionEngine {
  if (!_engine) {
    _engine = new SandboxExecutionEngine(config);
    _engine.registerHandler('default', defaultSandboxHandler);
    _engine.registerHandler('sandbox', defaultSandboxHandler);
  }
  return _engine;
}

/**
 * Reset the engine singleton (primarily for testing).
 */
export function resetSandboxExecutionEngine(): void {
  _engine = undefined;
}

/**
 * The default sandbox execution handler.
 * Simulates running a sandbox experiment and returns mock results.
 * Replace with actual sandbox runtime integration in production.
 */
async function defaultSandboxHandler(
  job: QueueJob<{ experiment_type?: string; target_gene?: string; sandbox_id?: string }>,
  signal: AbortSignal
): Promise<{
  job_id: string;
  status: string;
  result: unknown;
}> {
  // Simulate sandbox execution time (100ms - 2s)
  const executionTime = 100 + Math.random() * 1900;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, executionTime);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Job cancelled by signal'));
    });
  });

  const payload = job.payload ?? {};

  return {
    job_id: job.job_id,
    status: 'completed',
    result: {
      sandbox_id: payload.sandbox_id ?? job.sandbox_id,
      experiment_type: payload.experiment_type ?? 'default',
      target_gene: payload.target_gene ?? null,
      execution_time_ms: Math.round(executionTime),
      outcome: 'success',
      mutations_applied: Math.floor(Math.random() * 5) + 1,
      fitness_delta: (Math.random() - 0.3) * 10,
    },
  };
}

export { SandboxExecutionEngine, SandboxRateLimiter };
export type { QueueJob, RateLimitConfig, ExecutionHandler } from './types';
export {
  DEFAULT_RATE_LIMIT_CONFIG,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
} from './types';
