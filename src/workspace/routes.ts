/**
 * Workspace Routes - Fastify plugin for Workspace Leader/Worker management
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import * as workspaceService from './service';

function createResponse<T>(success: boolean, data?: T, err?: { code: string; message: string }) {
  return success ? { success: true, data } : { success: false, error: err };
}

export default async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  const { prisma, updateWorkerHeartbeat, createHeartbeatExtension, matchWorkers } = workspaceService;

  // POST / - Create workspace
  app.post('/', async (request, reply) => {
    try {
      const { name, description, root_goal, leader_config } = request.body as any;
      const ownerId = (request.headers['x-node-id'] as string) || 'anonymous';
      if (!name || !description || !root_goal) return reply.status(400).send(createResponse(false, undefined, { code: 'VALIDATION_ERROR', message: 'Missing required fields' }));
      const workspace = await workspaceService.createWorkspace({ name, description, root_goal, leader_config: leader_config || {} }, ownerId);
      return reply.status(201).send(createResponse(true, workspace));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // GET /:workspaceId - Get workspace status
  app.get('/:workspaceId', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const workspace = await workspaceService.getWorkspaceStatus(workspaceId);
      if (!workspace) return reply.status(404).send(createResponse(false, undefined, { code: 'WORKSPACE_NOT_FOUND', message: 'Not found' }));
      return reply.send(createResponse(true, workspace));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /:workspaceId/tasks - Create task
  app.post('/:workspaceId/tasks', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const body = request.body as any;
      const leaderId = (request.headers['x-leader-id'] as string) || (request.headers['x-node-id'] as string);
      if (!body.title || !body.description) return reply.status(400).send(createResponse(false, undefined, { code: 'VALIDATION_ERROR', message: 'Missing title or description' }));
      const task = await workspaceService.createTask(workspaceId, body, leaderId);
      return reply.status(201).send(createResponse(true, task));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // GET /:workspaceId/tasks/:taskId - Get task details
  app.get('/:workspaceId/tasks/:taskId', async (request, reply) => {
    try {
      const { taskId } = request.params as any;
      const task = await workspaceService.getTask(taskId);
      if (!task) return reply.status(404).send(createResponse(false, undefined, { code: 'TASK_NOT_FOUND', message: 'Not found' }));
      return reply.send(createResponse(true, task));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /:workspaceId/tasks/:taskId/report - Worker report progress
  app.post('/:workspaceId/tasks/:taskId/report', async (request, reply) => {
    try {
      const { taskId } = request.params as any;
      const workerId = (request.headers['x-worker-id'] as string) || (request.headers['x-node-id'] as string);
      const report = await workspaceService.workerReport(taskId, workerId, request.body as any);
      return reply.send(createResponse(true, report));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /:workspaceId/tasks/:taskId/complete - Complete task
  app.post('/:workspaceId/tasks/:taskId/complete', async (request, reply) => {
    try {
      const { taskId } = request.params as any;
      const workerId = (request.headers['x-worker-id'] as string) || (request.headers['x-node-id'] as string);
      const result = await workspaceService.completeTask(taskId, workerId, request.body as any);
      return reply.send(createResponse(true, result));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /:workspaceId/tasks/:taskId/blocked - Mark task blocked
  app.post('/:workspaceId/tasks/:taskId/blocked', async (request, reply) => {
    try {
      const { taskId } = request.params as any;
      const { reason } = request.body as any;
      await prisma.workspaceTask.update({ where: { task_id: taskId }, data: { status: 'blocked' } });
      return reply.send(createResponse(true, { task_id: taskId, status: 'blocked', reason }));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /workers/register - Register worker
  app.post('/workers/register', async (request, reply) => {
    try {
      const { node_id, capabilities, max_concurrent_tasks } = request.body as any;
      const workerId = `wrk_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const worker = await prisma.workspaceWorker.create({ data: { worker_id: workerId, node_id, agent_id: node_id, status: 'idle', capabilities: capabilities || [], max_concurrent_tasks: max_concurrent_tasks || 3 } });
      return reply.status(201).send(createResponse(true, { worker_id: worker.worker_id, node_id: worker.node_id, status: worker.status, registered_at: worker.registered_at.toISOString(), capabilities: worker.capabilities, max_concurrent_tasks: worker.max_concurrent_tasks }));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /workers/:workerId/heartbeat - Worker heartbeat
  app.post('/workers/:workerId/heartbeat', async (request, reply) => {
    try {
      const { workerId } = request.params as any;
      const { current_task_id, extension } = request.body as any;
      await updateWorkerHeartbeat(workerId, current_task_id);
      if (extension) await createHeartbeatExtension(workerId, workerId, extension.reason, extension.estimated_duration_ms);
      return reply.send(createResponse(true, { acknowledged: true, worker_id: workerId, next_heartbeat_in_ms: 60000 }));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // POST /:workspaceId/leader/team - Form team
  app.post('/:workspaceId/leader/team', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const { required_roles, match_strategy } = request.body as any;
      const roles = required_roles?.map((r: { role: string }) => r.role) || ['builder'];
      const matchedWorkers = await matchWorkers({ roles });
      return reply.send(createResponse(true, { workspace_id: workspaceId, matched_workers: matchedWorkers, formation_strategy: match_strategy || 'balanced' }));
    } catch (error) { return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' })); }
  });

  // ============================================================================
  // Workspace Chat (Group Chat) Routes
  // ============================================================================

  // POST /:workspaceId/chat/messages - Send a message to workspace chat
  app.post('/:workspaceId/chat/messages', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const body = request.body as any;
      const senderId = (request.headers['x-node-id'] as string) || 'anonymous';
      const senderName = (request.headers['x-sender-name'] as string) || 'Anonymous';
      const senderRole = (request.headers['x-sender-role'] as string) || 'participant';

      if (!body.content || body.content.trim().length === 0) {
        return reply.status(400).send(createResponse(false, undefined, { 
          code: 'VALIDATION_ERROR', 
          message: 'Message content is required' 
        }));
      }

      const result = await workspaceService.sendWorkspaceMessage(
        workspaceId,
        senderId,
        senderName,
        senderRole,
        {
          content: body.content,
          message_type: body.message_type,
          mentions: body.mentions,
          reply_to: body.reply_to,
          metadata: body.metadata,
        }
      );
      return reply.status(201).send(createResponse(true, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'WORKSPACE_NOT_FOUND') {
        return reply.status(404).send(createResponse(false, undefined, { 
          code: 'WORKSPACE_NOT_FOUND', 
          message: 'Workspace not found' 
        }));
      }
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });

  // GET /:workspaceId/chat/messages - List messages in workspace chat
  app.get('/:workspaceId/chat/messages', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const query = request.query as any;
      
      const result = await workspaceService.listWorkspaceMessages({
        workspace_id: workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        before: query.before,
        message_type: query.message_type,
      });
      return reply.send(createResponse(true, result));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });

  // POST /:workspaceId/chat/messages/:messageId/reaction - Add reaction to a message
  app.post('/:workspaceId/chat/messages/:messageId/reaction', async (request, reply) => {
    try {
      const { messageId } = request.params as any;
      const { emoji } = request.body as any;
      const userId = (request.headers['x-node-id'] as string) || 'anonymous';

      if (!emoji) {
        return reply.status(400).send(createResponse(false, undefined, { 
          code: 'VALIDATION_ERROR', 
          message: 'Emoji is required' 
        }));
      }

      const result = await workspaceService.addWorkspaceMessageReaction(messageId, userId, emoji);
      return reply.send(createResponse(true, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'MESSAGE_NOT_FOUND') {
        return reply.status(404).send(createResponse(false, undefined, { 
          code: 'MESSAGE_NOT_FOUND', 
          message: 'Message not found' 
        }));
      }
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });

  // PATCH /:workspaceId/chat/messages/:messageId/pin - Pin/unpin a message
  app.patch('/:workspaceId/chat/messages/:messageId/pin', async (request, reply) => {
    try {
      const { messageId } = request.params as any;
      const { is_pinned } = request.body as any;

      if (typeof is_pinned !== 'boolean') {
        return reply.status(400).send(createResponse(false, undefined, { 
          code: 'VALIDATION_ERROR', 
          message: 'is_pinned must be a boolean' 
        }));
      }

      const result = await workspaceService.pinWorkspaceMessage(messageId, is_pinned);
      return reply.send(createResponse(true, result));
    } catch (error) {
      if (error instanceof Error && error.message === 'MESSAGE_NOT_FOUND') {
        return reply.status(404).send(createResponse(false, undefined, { 
          code: 'MESSAGE_NOT_FOUND', 
          message: 'Message not found' 
        }));
      }
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });

  // DELETE /:workspaceId/chat/messages/:messageId - Delete a message
  app.delete('/:workspaceId/chat/messages/:messageId', async (request, reply) => {
    try {
      const { messageId } = request.params as any;
      const userId = (request.headers['x-node-id'] as string) || 'anonymous';

      await workspaceService.deleteWorkspaceMessage(messageId, userId);
      return reply.send(createResponse(true, { deleted: true }));
    } catch (error) {
      if (error instanceof Error && error.message === 'MESSAGE_NOT_FOUND') {
        return reply.status(404).send(createResponse(false, undefined, { 
          code: 'MESSAGE_NOT_FOUND', 
          message: 'Message not found' 
        }));
      }
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return reply.status(403).send(createResponse(false, undefined, { 
          code: 'FORBIDDEN', 
          message: 'You can only delete your own messages' 
        }));
      }
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });

  // GET /:workspaceId/chat/pinned - Get pinned messages
  app.get('/:workspaceId/chat/pinned', async (request, reply) => {
    try {
      const { workspaceId } = request.params as any;
      const result = await workspaceService.getPinnedMessages(workspaceId);
      return reply.send(createResponse(true, { messages: result }));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, { 
        code: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown' 
      }));
    }
  });
}
