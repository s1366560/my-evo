/**
 * GDI Refresh Worker — Health Status Provider
 *
 * Provides worker status for the /health endpoint.
 * In a full implementation, this would manage a background GDI refresh loop.
 */

export type WorkerStatus = 'running' | 'stopped' | 'degraded';

let _workerStatus: WorkerStatus = 'running';

/**
 * Get the current GDI refresh worker status.
 */
export function getGDIRefreshWorkerStatus(): WorkerStatus {
  return _workerStatus;
}

/**
 * Set the GDI refresh worker status (used by the worker manager).
 */
export function setGDIRefreshWorkerStatus(status: WorkerStatus): void {
  _workerStatus = status;
}
