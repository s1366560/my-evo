/**
 * Workspace Service - Core implementation for Workspace Leader/Worker management
 */

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  WORKER_MATCH_WEIGHTS,
  STALE_RECOVERY_RULES,
  VERIFICATION_THRESHOLDS,
} from './types';
import type {
  WorkspaceLeader,
  WorkspaceTask,
  TaskAttempt,
  PreflightCheck,
  PreflightEvidence,
  CreateWorkspaceRequest,
  CreateTaskRequest,
  WorkerReportRequest,
  CompleteTaskRequest,
  WorkspaceStatusResponse,
  MatchScore,
  HeartbeatExtension,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

// ============================================================================
// Workspace Operations
// ============================================================================

/**
 * Create a new Workspace with Leader
 */
export async function createWorkspace(
  request: CreateWorkspaceRequest,
  ownerId: string
): Promise<{
  workspace_id: string;
  leader_id: string;
  root_goal_id: string;
  name: string;
  status: string;
  created_at: string;
}> {
  const workspaceId = `ws_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const leaderId = `ldr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const rootGoalId = `goal_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date();

  const [workspace, leader] = await prisma.$transaction([
    prisma.workspace.create({
      data: {
        workspace_id: workspaceId,
        name: request.name,
        description: request.description,
        root_goal: request.root_goal,
        status: 'forming',
        leader_id: leaderId,
      },
    }),
    prisma.workspaceLeader.create({
      data: {
        leader_id: leaderId,
        workspace_id: workspaceId,
        root_goal_id: rootGoalId,
        status: 'forming',
        team_size: request.leader_config?.team_size || 3,
      },
    }),
  ]);

  return {
    workspace_id: workspace.workspace_id,
    leader_id: leader.leader_id,
    root_goal_id: rootGoalId,
    name: workspace.name,
    status: workspace.status,
    created_at: now.toISOString(),
  };
}

/**
 * Get Workspace status
 */
export async function getWorkspaceStatus(
  workspaceId: string
): Promise<WorkspaceStatusResponse | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { workspace_id: workspaceId },
    include: {
      tasks: { orderBy: { created_at: 'asc' } },
      leaders: { include: { team_members: true } },
    },
  });

  if (!workspace) return null;

  const leader = workspace.leaders[0];
  const tasks = workspace.tasks;

  const stats = {
    total_tasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  const progress = stats.total_tasks > 0 ? stats.completed / stats.total_tasks : 0;

  return {
    workspace_id: workspace.workspace_id,
    name: workspace.name,
    description: workspace.description,
    status: workspace.status as any,
    created_at: workspace.created_at.toISOString(),
    updated_at: workspace.updated_at.toISOString(),
    root_goal: {
      goal_id: leader?.root_goal_id || '',
      description: workspace.root_goal,
      progress,
      total_tasks: stats.total_tasks,
      completed_tasks: stats.completed,
      child_tasks: tasks.map(t => ({
        task_id: t.task_id,
        title: t.title,
        status: t.status as any,
        progress_pct: t.progress_pct,
      })),
    },
    leader: leader ? {
      leader_id: leader.leader_id,
      status: leader.status as any,
      team_size: leader.team_size,
      team_members: leader.team_members.map(m => ({
        id: m.id,
        leader_id: m.leader_id,
        worker_id: m.worker_id,
        role: m.role as any,
        assigned_tasks: m.assigned_tasks,
        status: m.status as any,
        joined_at: m.joined_at.toISOString(),
      })),
    } : { leader_id: '', status: 'forming', team_size: 0, team_members: [] },
    stats,
  };
}

/**
 * Update Workspace status
 */
export async function updateWorkspaceStatus(
  workspaceId: string,
  status: string
): Promise<void> {
  await prisma.$transaction([
    prisma.workspace.update({
      where: { workspace_id: workspaceId },
      data: { status },
    }),
    prisma.workspaceLeader.updateMany({
      where: { workspace_id: workspaceId },
      data: { status },
    }),
  ]);
}

// ============================================================================
// Task Operations
// ============================================================================

/**
 * Create a new Workspace Task
 */
export async function createTask(
  workspaceId: string,
  request: CreateTaskRequest,
  leaderId: string
): Promise<{
  task_id: string;
  workspace_task_id: string;
  workspace_id: string;
  attempt_id: string;
  status: string;
  assigned_worker_id: string | null;
  assigned_at: string;
  deadline: string | null;
}> {
  const taskId = `wst_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const attemptId = `att_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date();

  const task = await prisma.workspaceTask.create({
    data: {
      task_id: taskId,
      workspace_id: workspaceId,
      leader_id: leaderId,
      title: request.title,
      description: request.description,
      status: request.assigned_worker_id ? 'assigned' : 'pending',
      assigned_worker_id: request.assigned_worker_id || null,
      role: request.role || null,
      preflight_config: request.preflight_config ? JSON.parse(JSON.stringify(request.preflight_config)) : undefined,
      deadline: request.deadline ? new Date(request.deadline) : null,
      dependencies: request.dependencies || [],
    },
  });

  if (request.assigned_worker_id) {
    await prisma.taskAttempt.create({
      data: {
        attempt_id: attemptId,
        task_id: taskId,
        worker_id: request.assigned_worker_id,
        status: 'created',
      },
    });
  }

  return {
    task_id: taskId,
    workspace_task_id: taskId,
    workspace_id: workspaceId,
    attempt_id: attemptId,
    status: task.status,
    assigned_worker_id: task.assigned_worker_id,
    assigned_at: now.toISOString(),
    deadline: request.deadline || null,
  };
}

/**
 * Get Task details
 */
export async function getTask(taskId: string): Promise<any | null> {
  const task = await prisma.workspaceTask.findUnique({
    where: { task_id: taskId },
    include: {
      attempts: { orderBy: { started_at: 'desc' }, take: 1 },
      preflight_results: true,
    },
  });

  if (!task) return null;

  return {
    task_id: task.task_id,
    title: task.title,
    description: task.description,
    status: task.status,
    role: task.role,
    assigned_worker_id: task.assigned_worker_id,
    progress_pct: task.progress_pct,
    current_step: task.current_step,
    deadline: task.deadline?.toISOString() || null,
    created_at: task.created_at.toISOString(),
    updated_at: task.updated_at.toISOString(),
    current_attempt: task.attempts[0] || null,
    preflight_results: task.preflight_results.map(r => ({
      check_id: r.check_id,
      kind: r.kind,
      status: r.status,
      evidence: r.evidence,
      completed_at: r.captured_at?.toISOString() || null,
    })),
    artifacts: [],
    dependencies: task.dependencies,
  };
}

/**
 * Worker report progress
 */
export async function workerReport(
  taskId: string,
  workerId: string,
  request: WorkerReportRequest
): Promise<{
  acknowledged: boolean;
  task_status: string;
  next_heartbeat_in_ms: number;
  extension_granted: boolean;
  extension_expires_at?: string;
}> {
  const now = new Date();

  await prisma.workspaceTask.update({
    where: { task_id: taskId },
    data: {
      status: request.status,
      progress_pct: request.progress_pct,
      current_step: request.current_step,
      updated_at: now,
    },
  });

  let extensionGranted = false;
  let extensionExpiresAt: string | undefined;

  if (request.heartbeat_extension) {
    const ext = request.heartbeat_extension;
    const expiresAt = new Date(now.getTime() + ext.estimated_duration_ms);
    await prisma.heartbeatExtension.create({
      data: {
        task_id: taskId,
        worker_id: workerId,
        reason: ext.reason,
        estimated_duration_ms: ext.estimated_duration_ms,
        extended_until: expiresAt,
      },
    });
    extensionGranted = true;
    extensionExpiresAt = expiresAt.toISOString();
  }

  if (request.preflight_evidence && request.preflight_evidence.length > 0) {
    const task = await prisma.workspaceTask.findUnique({
      where: { task_id: taskId },
      include: { attempts: { take: 1, orderBy: { started_at: 'desc' } } },
    });

    if (task?.attempts[0]) {
      for (const evidence of request.preflight_evidence) {
        await prisma.preflightResult.upsert({
          where: { id: `${task.task_id}-${evidence.check_id}-${task.attempts[0].attempt_id}` },
          create: {
            id: `${task.task_id}-${evidence.check_id}-${task.attempts[0].attempt_id}`,
            task_id: taskId,
            attempt_id: task.attempts[0].attempt_id,
            check_id: evidence.check_id,
            kind: evidence.check_kind,
            status: 'passed',
            evidence: evidence.evidence_content as string,
            captured_at: new Date(evidence.captured_at),
          },
          update: {
            status: 'passed',
            evidence: evidence.evidence_content as string,
            captured_at: new Date(evidence.captured_at),
          },
        });
      }
    }
  }

  return {
    acknowledged: true,
    task_status: request.status,
    next_heartbeat_in_ms: STALE_RECOVERY_RULES.HEARTBEAT_INTERVAL_MS,
    extension_granted: extensionGranted,
    extension_expires_at: extensionExpiresAt,
  };
}

/**
 * Complete a task
 */
export async function completeTask(
  taskId: string,
  workerId: string,
  request: CompleteTaskRequest
): Promise<{
  task_id: string;
  status: string;
  completed_at: string;
  verification_results: any[];
  artifacts: string[];
}> {
  const now = new Date();

  await prisma.workspaceTask.update({
    where: { task_id: taskId },
    data: { status: 'completed', progress_pct: 100, completed_at: now },
  });

  const latestAttempt = await prisma.taskAttempt.findFirst({
    where: { task_id: taskId },
    orderBy: { started_at: 'desc' },
  });

  if (latestAttempt) {
    await prisma.taskAttempt.update({
      where: { id: latestAttempt.id },
      data: {
        status: 'completed',
        completed_at: now,
        summary: request.summary,
        artifacts: request.artifacts as any,
        verifications: request.verifications as any,
        execution_metrics: request.execution_metrics as any,
      },
    });
  }

  if (request.preflight_checklist) {
    for (const check of request.preflight_checklist) {
      await prisma.preflightResult.upsert({
        where: { id: `${taskId}-${check.check_id}-${latestAttempt?.attempt_id || 'final'}` },
        create: {
          id: `${taskId}-${check.check_id}-${latestAttempt?.attempt_id || 'final'}`,
          task_id: taskId,
          attempt_id: latestAttempt?.attempt_id,
          check_id: check.check_id,
          kind: check.kind,
          status: check.status,
          evidence: check.evidence,
          captured_at: check.completed_at ? new Date(check.completed_at) : now,
        },
        update: {
          status: check.status,
          evidence: check.evidence,
          captured_at: check.completed_at ? new Date(check.completed_at) : now,
        },
      });
    }
  }

  const preflightResults = await prisma.preflightResult.findMany({
    where: { task_id: taskId },
  });

  const preflightPassed = preflightResults.every(r => r.status === 'passed');

  const verification_results = [
    {
      dimension: 'preflight',
      passed: preflightPassed,
      score: preflightPassed ? 100 : 0,
      messages: preflightPassed ? ['All preflight checks passed'] : [`${preflightResults.filter(r => r.status !== 'passed').length} checks failed`],
    },
    { dimension: 'completeness', passed: true, score: 90, messages: ['Task marked as completed'] },
  ];

  return {
    task_id: taskId,
    status: 'completed',
    completed_at: now.toISOString(),
    verification_results,
    artifacts: request.artifacts,
  };
}

// ============================================================================
// Worker Pool Integration
// ============================================================================

/**
 * Match workers to task requirements
 */
export async function matchWorkers(
  requirements: { roles: string[]; skills?: string[] },
  limit = 5
): Promise<MatchScore[]> {
  const workers = await prisma.workspaceWorker.findMany({
    where: { status: 'idle' },
    take: 50,
  });

  const scores: MatchScore[] = [];

  for (const worker of workers) {
    const capabilities = (worker.capabilities as any[]) || [];
    const roleMatch = requirements.roles.some(r => capabilities.some((c: any) => c.category === r)) ? 1 : 0;
    const workerSkills = capabilities.flatMap((c: any) => c.skills || []);
    const skillOverlap = requirements.skills && requirements.skills.length > 0
      ? workerSkills.filter((s: string) => requirements.skills!.includes(s)).length / requirements.skills.length : 1;
    const availability = 1;
    const reputation = 0.7;
    const currentTasks = (worker.current_tasks as string[]) || [];
    const loadFactor = 1 - (currentTasks.length / worker.max_concurrent_tasks);

    const finalScore =
      WORKER_MATCH_WEIGHTS.role_match * roleMatch +
      WORKER_MATCH_WEIGHTS.skill_overlap * skillOverlap +
      WORKER_MATCH_WEIGHTS.availability * availability +
      WORKER_MATCH_WEIGHTS.reputation * reputation +
      WORKER_MATCH_WEIGHTS.load_factor * loadFactor;

    scores.push({ worker_id: worker.worker_id, role_match: roleMatch, skill_overlap: skillOverlap, availability, reputation, load_factor: loadFactor, final_score: finalScore });
  }

  return scores.sort((a, b) => b.final_score - a.final_score).slice(0, limit);
}

// ============================================================================
// Heartbeat and Stale Recovery
// ============================================================================

/**
 * Check if worker should be marked as blocked
 */
export async function shouldMarkBlocked(workerId: string): Promise<boolean> {
  const worker = await prisma.workspaceWorker.findUnique({ where: { worker_id: workerId } });
  if (!worker) return true;

  const lastHeartbeat = new Date(worker.last_heartbeat).getTime();
  const now = Date.now();
  const elapsed = now - lastHeartbeat;

  const activeExtension = await prisma.heartbeatExtension.findFirst({
    where: { worker_id: workerId, extended_until: { gt: new Date() } },
  });

  if (activeExtension) return false;
  if (elapsed < STALE_RECOVERY_RULES.BLOCK_THRESHOLD_MS) return false;
  return true;
}

/**
 * Update worker heartbeat
 */
export async function updateWorkerHeartbeat(workerId: string, currentTaskId?: string): Promise<void> {
  await prisma.workspaceWorker.update({
    where: { worker_id: workerId },
    data: {
      last_heartbeat: new Date(),
      status: currentTaskId ? 'in_progress' : 'idle',
    },
  });
}

/**
 * Create heartbeat extension
 */
export async function createHeartbeatExtension(
  taskId: string,
  workerId: string,
  reason: string,
  durationMs: number
): Promise<HeartbeatExtension> {
  const now = new Date();
  const extendedUntil = new Date(now.getTime() + durationMs);

  const ext = await prisma.heartbeatExtension.create({
    data: {
      task_id: taskId,
      worker_id: workerId,
      reason,
      estimated_duration_ms: durationMs,
      extended_until: extendedUntil,
    },
  });

  return {
    task_id: ext.task_id,
    worker_id: ext.worker_id,
    extended_until: extendedUntil.toISOString(),
    reason: ext.reason as any,
    estimated_duration_ms: ext.estimated_duration_ms,
  };
}

// ============================================================================
// Workspace Chat (Group Chat) Functions
// ============================================================================

import { Prisma } from '@prisma/client';
import type {
  SendWorkspaceMessageRequest,
  SendWorkspaceMessageResponse,
  ListWorkspaceMessagesRequest,
  ListWorkspaceMessagesResponse,
  WorkspaceMessage,
  WorkspaceMessageReaction,
} from './types';

/**
 * Send a message to a workspace chat
 */
export async function sendWorkspaceMessage(
  workspaceId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  request: SendWorkspaceMessageRequest
): Promise<SendWorkspaceMessageResponse> {
  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { workspace_id: workspaceId },
  });
  
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }

  const messageId = `wsm_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date();

  const message = await prisma.workspaceMessage.create({
    data: {
      message_id: messageId,
      workspace_id: workspaceId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      content: request.content,
      message_type: request.message_type || 'text',
      metadata: (request.metadata || {}) as Prisma.InputJsonValue,
      mentions: request.mentions || [],
      reply_to: request.reply_to || null,
      reactions: [] as Prisma.InputJsonValue,
      is_pinned: false,
    },
  });

  return {
    message_id: message.message_id,
    workspace_id: message.workspace_id,
    sender_id: message.sender_id,
    created_at: now.toISOString(),
  };
}

/**
 * List messages in a workspace chat with pagination
 */
export async function listWorkspaceMessages(
  request: ListWorkspaceMessagesRequest
): Promise<ListWorkspaceMessagesResponse> {
  const limit = Math.min(request.limit || 50, 100);

  // Build where clause
  const where: any = {
    workspace_id: request.workspace_id,
  };

  if (request.message_type) {
    where.message_type = request.message_type;
  }

  // Cursor-based pagination
  if (request.before) {
    where.message_id = { lt: request.before };
  }

  const messages = await prisma.workspaceMessage.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit + 1, // Fetch one extra to check if there are more
  });

  const hasMore = messages.length > limit;
  const results = hasMore ? messages.slice(0, limit) : messages;
  
  // Reverse to get chronological order (oldest first)
  results.reverse();

  const nextCursor = hasMore && results.length > 0 && results[0] ? results[0].message_id : undefined;
  
  return {
    messages: results.map((m: any) => ({
      id: m.id,
      message_id: m.message_id,
      workspace_id: m.workspace_id,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      sender_role: m.sender_role,
      content: m.content,
      message_type: m.message_type as any,
      metadata: (m.metadata || {}) as Record<string, unknown>,
      mentions: m.mentions || [],
      reply_to: m.reply_to,
      reactions: (m.reactions || []) as unknown as WorkspaceMessageReaction[],
      is_pinned: m.is_pinned,
      created_at: m.created_at.toISOString(),
      updated_at: m.updated_at.toISOString(),
    })),
    has_more: hasMore,
    next_cursor: nextCursor,
  };
}

/**
 * Add a reaction to a workspace message
 */
export async function addWorkspaceMessageReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<WorkspaceMessage> {
  const message = await prisma.workspaceMessage.findUnique({
    where: { message_id: messageId },
  });

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  const reactions = (message.reactions || []) as unknown as WorkspaceMessageReaction[];
  
  // Check if user already reacted with this emoji
  const existingIndex = reactions.findIndex(
    r => r.user_id === userId && r.emoji === emoji
  );

  if (existingIndex >= 0) {
    // Remove the reaction (toggle behavior)
    reactions.splice(existingIndex, 1);
  } else {
    // Add new reaction
    reactions.push({
      emoji,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
  }

  const updated = await prisma.workspaceMessage.update({
    where: { message_id: messageId },
    data: { reactions: reactions as unknown as Prisma.InputJsonValue },
  });

  return {
    id: updated.id,
    message_id: updated.message_id,
    workspace_id: updated.workspace_id,
    sender_id: updated.sender_id,
    sender_name: updated.sender_name,
    sender_role: updated.sender_role,
    content: updated.content,
    message_type: updated.message_type as any,
    metadata: (updated.metadata || {}) as Record<string, unknown>,
    mentions: updated.mentions || [],
    reply_to: updated.reply_to,
    reactions: (updated.reactions || []) as unknown as WorkspaceMessageReaction[],
    is_pinned: updated.is_pinned,
    created_at: updated.created_at.toISOString(),
    updated_at: updated.updated_at.toISOString(),
  };
}

/**
 * Pin or unpin a workspace message
 */
export async function pinWorkspaceMessage(
  messageId: string,
  isPinned: boolean
): Promise<WorkspaceMessage> {
  const message = await prisma.workspaceMessage.findUnique({
    where: { message_id: messageId },
  });

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  const updated = await prisma.workspaceMessage.update({
    where: { message_id: messageId },
    data: { is_pinned: isPinned },
  });

  return {
    id: updated.id,
    message_id: updated.message_id,
    workspace_id: updated.workspace_id,
    sender_id: updated.sender_id,
    sender_name: updated.sender_name,
    sender_role: updated.sender_role,
    content: updated.content,
    message_type: updated.message_type as any,
    metadata: (updated.metadata || {}) as Record<string, unknown>,
    mentions: updated.mentions || [],
    reply_to: updated.reply_to,
    reactions: (updated.reactions || []) as unknown as WorkspaceMessageReaction[],
    is_pinned: updated.is_pinned,
    created_at: updated.created_at.toISOString(),
    updated_at: updated.updated_at.toISOString(),
  };
}

/**
 * Delete a workspace message (soft delete by clearing content)
 */
export async function deleteWorkspaceMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  const message = await prisma.workspaceMessage.findUnique({
    where: { message_id: messageId },
  });

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  // Only sender can delete their own messages
  if (message.sender_id !== userId) {
    throw new Error('FORBIDDEN');
  }

  await prisma.workspaceMessage.update({
    where: { message_id: messageId },
    data: { 
      content: '[deleted]',
      message_type: 'system',
    },
  });

  return true;
}

/**
 * Get pinned messages in a workspace
 */
export async function getPinnedMessages(
  workspaceId: string
): Promise<WorkspaceMessage[]> {
  const messages = await prisma.workspaceMessage.findMany({
    where: {
      workspace_id: workspaceId,
      is_pinned: true,
    },
    orderBy: { created_at: 'asc' },
  });

  return messages.map((m: any) => ({
    id: m.id,
    message_id: m.message_id,
    workspace_id: m.workspace_id,
    sender_id: m.sender_id,
    sender_name: m.sender_name,
    sender_role: m.sender_role,
    content: m.content,
    message_type: m.message_type as any,
    metadata: (m.metadata || {}) as Record<string, unknown>,
    mentions: m.mentions || [],
    reply_to: m.reply_to,
    reactions: (m.reactions || []) as unknown as WorkspaceMessageReaction[],
    is_pinned: m.is_pinned,
    created_at: m.created_at.toISOString(),
    updated_at: m.updated_at.toISOString(),
  }));
}
