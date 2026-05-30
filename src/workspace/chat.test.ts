/**
 * Workspace Chat Tests - Part 1
 */
import { PrismaClient } from '@prisma/client';
import * as service from './service';

const mockPrisma = {
  $transaction: jest.fn((fn: any) => typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn)),
  workspace: { findUnique: jest.fn() },
  workspaceMessage: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
} as any;

describe('Workspace Chat Service', () => {
  beforeAll(() => { service.setPrisma(mockPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('sendWorkspaceMessage', () => {
    it('should send a text message', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ workspace_id: 'ws_1' });
      mockPrisma.workspaceMessage.create.mockResolvedValue({
        id: 'msg_1', message_id: 'wsm_abc123', workspace_id: 'ws_1',
        sender_id: 'node_1', sender_name: 'Test', sender_role: 'builder',
        content: 'Hello!', message_type: 'text', metadata: {}, mentions: [],
        reply_to: null, reactions: [], is_pinned: false,
        created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.sendWorkspaceMessage(
        'ws_1', 'node_1', 'Test', 'builder', { content: 'Hello!' }
      );

      expect(result.workspace_id).toBe('ws_1');
      expect(mockPrisma.workspaceMessage.create).toHaveBeenCalled();
    });

    it('should throw error for non-existent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      await expect(
        service.sendWorkspaceMessage('nonexistent', 'node_1', 'Test', 'builder', { content: 'Hi' })
      ).rejects.toThrow('WORKSPACE_NOT_FOUND');
    });

    it('should send message with mentions', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ workspace_id: 'ws_1' });
      mockPrisma.workspaceMessage.create.mockResolvedValue({
        id: 'msg_2', message_id: 'wsm_def', workspace_id: 'ws_1',
        sender_id: 'node_1', sender_name: 'Test', sender_role: 'builder',
        content: 'Hey @arch', message_type: 'mention', metadata: {}, mentions: ['architect'],
        reply_to: null, reactions: [], is_pinned: false,
        created_at: new Date(), updated_at: new Date(),
      });

      await service.sendWorkspaceMessage(
        'ws_1', 'node_1', 'Test', 'builder',
        { content: 'Hey @arch', message_type: 'mention', mentions: ['architect'] }
      );

      expect(mockPrisma.workspaceMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mentions: ['architect'] }) })
      );
    });
  });

  describe('listWorkspaceMessages', () => {
    it('should list messages', async () => {
      mockPrisma.workspaceMessage.findMany.mockResolvedValue([
        { message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
          content: 'First', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
          reactions: [], is_pinned: false, created_at: new Date('2024-01-01'), updated_at: new Date() },
        { message_id: 'wsm_2', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
          content: 'Second', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
          reactions: [], is_pinned: false, created_at: new Date('2024-01-02'), updated_at: new Date() },
      ]);

      const result = await service.listWorkspaceMessages({ workspace_id: 'ws_1' });

      expect(result.messages).toHaveLength(2);
      expect(result.has_more).toBe(false);
    });

    it('should return chronological order', async () => {
      mockPrisma.workspaceMessage.findMany.mockResolvedValue([
        { message_id: 'wsm_2', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
          content: 'Second', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
          reactions: [], is_pinned: false, created_at: new Date('2024-01-02'), updated_at: new Date() },
        { message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
          content: 'First', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
          reactions: [], is_pinned: false, created_at: new Date('2024-01-01'), updated_at: new Date() },
      ]);

      const result = await service.listWorkspaceMessages({ workspace_id: 'ws_1' });

      expect(result.messages[0]?.message_id).toBe('wsm_1');
      expect(result.messages[1]?.message_id).toBe('wsm_2');
    });

    it('should handle pagination', async () => {
      const msgs = Array.from({ length: 11 }, (_, i) => ({
        message_id: `wsm_${i}`, workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
        content: `Msg ${i}`, message_type: 'text', metadata: {}, mentions: [], reply_to: null,
        reactions: [], is_pinned: false,
        created_at: new Date(`2024-01-${String(i+1).padStart(2,'0')}`), updated_at: new Date(),
      }));
      mockPrisma.workspaceMessage.findMany.mockResolvedValue(msgs);

      const result = await service.listWorkspaceMessages({ workspace_id: 'ws_1', limit: 10 });

      expect(result.messages).toHaveLength(10);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe('wsm_9');
    });
  });

  describe('addWorkspaceMessageReaction', () => {
    it('should add reaction', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue({ message_id: 'wsm_1', reactions: [] });
      mockPrisma.workspaceMessage.update.mockResolvedValue({
        message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n1', sender_name: 'U', sender_role: 'b',
        content: 'Hi', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
        reactions: [{ emoji: '👍', user_id: 'node_2', created_at: new Date().toISOString() }],
        is_pinned: false, created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.addWorkspaceMessageReaction('wsm_1', 'node_2', '👍');

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0]?.emoji).toBe('👍');
    });

    it('should toggle off existing reaction', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue({
        message_id: 'wsm_1',
        reactions: [{ emoji: '👍', user_id: 'node_2', created_at: '2024-01-01' }],
      });
      mockPrisma.workspaceMessage.update.mockResolvedValue({
        message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n1', sender_name: 'U', sender_role: 'b',
        content: 'Hi', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
        reactions: [], is_pinned: false, created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.addWorkspaceMessageReaction('wsm_1', 'node_2', '👍');

      expect(result.reactions).toHaveLength(0);
    });

    it('should throw for non-existent message', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue(null);
      await expect(service.addWorkspaceMessageReaction('nonexistent', 'node_1', '👍'))
        .rejects.toThrow('MESSAGE_NOT_FOUND');
    });
  });

  describe('pinWorkspaceMessage', () => {
    it('should pin a message', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue({ message_id: 'wsm_1', is_pinned: false });
      mockPrisma.workspaceMessage.update.mockResolvedValue({
        message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
        content: 'Important', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
        reactions: [], is_pinned: true, created_at: new Date(), updated_at: new Date(),
      });

      const result = await service.pinWorkspaceMessage('wsm_1', true);

      expect(result.is_pinned).toBe(true);
    });

    it('should throw for non-existent message', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue(null);
      await expect(service.pinWorkspaceMessage('nonexistent', true))
        .rejects.toThrow('MESSAGE_NOT_FOUND');
    });
  });

  describe('deleteWorkspaceMessage', () => {
    it('should delete own message', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue({
        message_id: 'wsm_1', sender_id: 'node_1', content: 'Hello',
      });
      mockPrisma.workspaceMessage.update.mockResolvedValue({});

      const result = await service.deleteWorkspaceMessage('wsm_1', 'node_1');

      expect(result).toBe(true);
      expect(mockPrisma.workspaceMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ content: '[deleted]' }) })
      );
    });

    it('should throw when deleting others message', async () => {
      mockPrisma.workspaceMessage.findUnique.mockResolvedValue({
        message_id: 'wsm_1', sender_id: 'node_1', content: 'Hello',
      });

      await expect(service.deleteWorkspaceMessage('wsm_1', 'node_2'))
        .rejects.toThrow('FORBIDDEN');
    });
  });

  describe('getPinnedMessages', () => {
    it('should get pinned messages', async () => {
      mockPrisma.workspaceMessage.findMany.mockResolvedValue([
        { message_id: 'wsm_1', workspace_id: 'ws_1', sender_id: 'n', sender_name: 'U', sender_role: 'b',
          content: 'Pinned', message_type: 'text', metadata: {}, mentions: [], reply_to: null,
          reactions: [], is_pinned: true, created_at: new Date(), updated_at: new Date() },
      ]);

      const result = await service.getPinnedMessages('ws_1');

      expect(result).toHaveLength(1);
      expect(result[0]?.is_pinned).toBe(true);
    });

    it('should return empty when no pinned', async () => {
      mockPrisma.workspaceMessage.findMany.mockResolvedValue([]);

      const result = await service.getPinnedMessages('ws_1');

      expect(result).toHaveLength(0);
    });
  });
});
