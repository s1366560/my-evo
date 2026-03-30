/**
 * Heartbeat Module
 * Implements POST /a2a/heartbeat endpoint
 * Heartbeat interval: 5 minutes (per evomap.ai spec)
 * Offline threshold: 45 minutes
 */

import { HeartbeatPayload, HeartbeatResponse, Task, OverdueTask, Peer, CommitmentResult } from './types';
import { validateNodeSecret, updateHeartbeat, isNodeOffline, markNodeOffline, getNodeInfo } from './node';

// In-memory stores (would be DB in production)
const pendingEvents = new Map<string, unknown[]>();
const availableTasks: Task[] = [];

// Configuration - per evomap.ai spec (updated from 15min to 5min)
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes (was 15min)
const OFFLINE_THRESHOLD_MS = 45 * 60 * 1000;     // 45 minutes

/**
 * Process heartbeat from a node
 */
export async function processHeartbeat(
  authHeader: string | undefined,
  payload: HeartbeatPayload
): Promise<HeartbeatResponse> {
  // Validate authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const secret = authHeader.substring(7);
  const nodeId = validateNodeSecret(secret);
  
  if (!nodeId) {
    throw new Error('Unauthorized: Invalid node_secret');
  }

  // Update heartbeat timestamp
  const updated = updateHeartbeat(nodeId);
  if (!updated) {
    throw new Error('Node not found');
  }

  // Check for overdue tasks
  const overdueTasks = getOverdueTasks(nodeId);

  // Get pending events for this node
  const events = getPendingEvents(nodeId);
  pendingEvents.set(nodeId, []);  // Clear after fetching

  // Get recommended tasks (from heartbeat response)
  const tasks = getAvailableTasks(nodeId);

  // Get peer nodes
  const peers = getActivePeers(nodeId);

  // Process commitment updates
  const commitmentResults: CommitmentResult[] = [];
  if (payload.meta?.commitment_updates) {
    for (const update of payload.meta.commitment_updates) {
      commitmentResults.push({
        task_id: update.task_id,
        success: true
      });
    }
  }

  return {
    status: 'ok',
    available_tasks: tasks.slice(0, 5),  // Max 5 tasks per heartbeat
    overdue_tasks: overdueTasks,
    peers: peers,
    commitment_results: commitmentResults
  };
}

/**
 * Get pending events for a node
 */
export function getPendingEvents(nodeId: string): unknown[] {
  return pendingEvents.get(nodeId) || [];
}

/**
 * Clear pending events for a node (after delivery)
 */
export function clearPendingEvents(nodeId: string): void {
  pendingEvents.set(nodeId, []);
}

/**
 * Add an event for a node (called by other modules)
 */
export function addPendingEvent(nodeId: string, event: unknown): void {
  const events = pendingEvents.get(nodeId) || [];
  events.push(event);
  pendingEvents.set(nodeId, events);
}

/**
 * Get overdue tasks for a node
 */
function getOverdueTasks(nodeId: string): OverdueTask[] {
  // In production, this would query the task database
  // For now, return empty array
  return [];
}

/**
 * Get available tasks for a node based on reputation
 */
function getAvailableTasks(nodeId: string): Task[] {
  const node = getNodeInfo(nodeId);
  if (!node) return [];

  // Filter tasks based on node's reputation and model tier
  // In production, this would query the task database
  return availableTasks.filter(task => {
    // Simple filter: tasks with reward >= node's average capability
    return task.reward > 0;
  });
}

/**
 * Add a task to the available pool
 */
export function addAvailableTask(task: Task): void {
  availableTasks.push(task);
}

/**
 * Claim a task
 */
export function claimTask(nodeId: string, taskId: string): boolean {
  const taskIndex = availableTasks.findIndex(t => t.task_id === taskId);
  if (taskIndex === -1) return false;
  
  // In production, would also record the claim in DB
  return true;
}

/**
 * Get active peer nodes (collaborators from sessions and circles)
 */
function getActivePeers(currentNodeId: string): Peer[] {
  // In production, this would query:
  // - Active collaboration sessions
  // - Evolution circles / guilds
  // Only return peers with activity in last 24 hours
  return [];
}

/**
 * Check all nodes and mark offline ones
 */
export function checkNodeStatuses(): void {
  // In production, this would run on a scheduler
  // For now, just a utility function
}

/**
 * Get heartbeat configuration
 */
export function getHeartbeatConfig() {
  return {
    interval_ms: HEARTBEAT_INTERVAL_MS,
    offline_threshold_ms: OFFLINE_THRESHOLD_MS,
    interval_minutes: HEARTBEAT_INTERVAL_MS / 60000,
    offline_threshold_minutes: OFFLINE_THRESHOLD_MS / 60000
  };
}

export { HEARTBEAT_INTERVAL_MS, OFFLINE_THRESHOLD_MS };
