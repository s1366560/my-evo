/**
 * Worker Pool Module
 * Phase 3-4: Worker Pool for distributed task execution
 */

export * from './types';
export {
  // Worker management
  registerWorker,
  getWorker,
  listWorkers,
  updateWorkerAvailability,
  updateWorkerReputation,
  setWorkerOffline,
  getWorkersByDomain,
  // Specialist pools
  getSpecialistPool,
  listSpecialistPools,
  addTaskToSpecialistPool,
  getSpecialistTaskQueue,
  claimSpecialistTask,
  // Task assignment
  assignTask,
  completeAssignment,
  getAssignment,
  getWorkerAssignments,
  // Matchmaking
  matchWorkerToTask,
  autoAssignSpecialistTask,
  // Stats
  getWorkerPoolStats,
  pruneInactiveWorkers,
} from './engine';
