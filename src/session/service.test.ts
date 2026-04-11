import * as service from './service';

const mockPrisma = {
  collaborationSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.collaborationSession.updateMany.mockResolvedValue({ count: 1 });
});

const makeSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-1',
  title: 'Test Session',
  status: 'active',
  creator_id: 'node-1',
  members: [
    {
      node_id: 'node-1',
      role: 'organizer',
      joined_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      is_active: true,
    },
  ] as unknown as Record<string, unknown>[],
  context: {},
  max_participants: 5,
  consensus_config: { algorithm: 'majority', quorum: 3 },
  vector_clock: {} as Record<string, number>,
  messages: [] as unknown as Record<string, unknown>[],
  created_at: new Date(),
  updated_at: new Date(),
  expires_at: new Date(Date.now() + 7200000),
  ...overrides,
});

describe('Session Service', () => {
  describe('createSession', () => {
    it('should create a session with creator as organizer', async () => {
      const mockSession = makeSession();
      mockPrisma.collaborationSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession('node-1', 'Test Session');

      expect(result.title).toBe('Test Session');
      expect(result.status).toBe('active');
      expect(mockPrisma.collaborationSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creator_id: 'node-1',
            status: 'active',
            max_participants: 5,
          }),
        }),
      );
    });

    it('should create with custom maxParticipants', async () => {
      const mockSession = makeSession({ max_participants: 10 });
      mockPrisma.collaborationSession.create.mockResolvedValue(mockSession);

      const result = await service.createSession('node-1', 'Test', 10);

      expect(mockPrisma.collaborationSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ max_participants: 10 }),
        }),
      );
    });

    it('should reject maxParticipants below 2', async () => {
      await expect(
        service.createSession('node-1', 'Test', 1),
      ).rejects.toThrow('maxParticipants must be between 2 and 50');
    });

    it('should reject maxParticipants above 50', async () => {
      await expect(
        service.createSession('node-1', 'Test', 51),
      ).rejects.toThrow('maxParticipants must be between 2 and 50');
    });
  });

  describe('joinSession', () => {
    it('should add a member to an active session', async () => {
      const mockSession = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.joinSession('session-1', 'node-2');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            members: expect.arrayContaining([
              expect.objectContaining({
                node_id: 'node-2',
                role: 'participant',
                is_active: true,
              }),
            ]),
          }),
        }),
      );
    });

    it('should reject joining a non-active session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({ status: 'completed' }),
      );

      await expect(
        service.joinSession('session-1', 'node-2'),
      ).rejects.toThrow('Session is not active');
    });

    it('should reject joining a full session', async () => {
      const fullMembers = Array.from({ length: 5 }, (_, i) => ({
        node_id: `node-${i}`,
        role: 'participant',
        joined_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        is_active: true,
      }));
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({ members: fullMembers }),
      );

      await expect(
        service.joinSession('session-1', 'node-new'),
      ).rejects.toThrow('Session is full');
    });

    it('should reject duplicate join', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.joinSession('session-1', 'node-1'),
      ).rejects.toThrow('already in this session');
    });

    it('should throw NotFoundError for missing session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.joinSession('nonexistent', 'node-1'),
      ).rejects.toThrow('Session not found');
    });

    it('should reject concurrent join updates with a conflict', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      mockPrisma.collaborationSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.joinSession('session-1', 'node-2')).rejects.toThrow(
        'Session changed; retry',
      );
    });
  });

  describe('leaveSession', () => {
    it('should mark member as inactive', async () => {
      const session = makeSession({
        members: [
          {
            node_id: 'node-1',
            role: 'organizer',
            joined_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
            is_active: true,
          },
          {
            node_id: 'node-2',
            role: 'participant',
            joined_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
            is_active: true,
          },
        ],
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      await service.leaveSession('session-1', 'node-2');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
          }),
        }),
      );
    });

    it('should cancel session when last member leaves', async () => {
      const session = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      await service.leaveSession('session-1', 'node-1');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
          }),
        }),
      );
    });

    it('should reject leaving if not a member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.leaveSession('session-1', 'node-unknown'),
      ).rejects.toThrow('not in this session');
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.leaveSession('nonexistent', 'node-1'),
      ).rejects.toThrow('Session not found');
    });

    it('should reject concurrent leave updates with a conflict', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      mockPrisma.collaborationSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.leaveSession('session-1', 'node-1')).rejects.toThrow(
        'Session changed; retry',
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a message and update vector clock', async () => {
      const session = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      const result = await service.sendMessage(
        'session-1', 'node-1', 'query', 'Hello world',
      );

      expect(result.message).toBeDefined();
      expect(result.message.content).toBe('Hello world');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vector_clock: { 'node-1': 1 },
          }),
        }),
      );
    });

    it('should increment vector clock on subsequent messages', async () => {
      const session = makeSession({
        vector_clock: { 'node-1': 2 },
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      await service.sendMessage('session-1', 'node-1', 'query', 'msg');

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vector_clock: { 'node-1': 3 },
          }),
        }),
      );
    });

    it('should increment sender clock to 1 when senderId not in vector_clock', async () => {
      const session = makeSession({
        members: [
          { node_id: 'node-1', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' },
          { node_id: 'node-2', role: 'participant', is_active: true, joined_at: '', last_heartbeat: '' },
        ],
        vector_clock: { 'node-1': 5 },
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      await service.sendMessage('session-1', 'node-2', 'query', 'msg');

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vector_clock: { 'node-1': 5, 'node-2': 1 },
          }),
        }),
      );
    });

    it('should handle null vector_clock by defaulting to empty object', async () => {
      const session = makeSession({
        vector_clock: null as unknown as Record<string, number>,
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      const result = await service.sendMessage('session-1', 'node-1', 'query', 'msg');

      expect(result.message).toBeDefined();
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vector_clock: { 'node-1': 1 },
          }),
        }),
      );
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('nonexistent', 'node-1', 'query', 'msg'),
      ).rejects.toThrow('Session not found');
    });

    it('should reject message when session is not active', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({ status: 'completed' }),
      );

      await expect(
        service.sendMessage('session-1', 'node-1', 'query', 'msg'),
      ).rejects.toThrow('Session is not active');
    });

    it('should reject message from non-member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.sendMessage('session-1', 'node-outsider', 'query', 'msg'),
      ).rejects.toThrow('Only session members');
    });

    it('should reject concurrent message updates with a conflict', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      mockPrisma.collaborationSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.sendMessage('session-1', 'node-1', 'query', 'msg'),
      ).rejects.toThrow('Session changed; retry');
    });
  });

  describe('proposeConsensus', () => {
    it('should create a consensus proposal', async () => {
      const session = makeSession({
        messages: [],
        vector_clock: { 'node-1': 0 },
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      const result = await service.proposeConsensus(
        'session-1', 'node-1', 'merge', 'Merge strategy A',
      );

      expect(result.proposal).toBeDefined();
      expect(result.proposal.proposer_id).toBe('node-1');
      expect(result.proposal.type).toBe('merge');
      expect(result.proposal.content).toBe('Merge strategy A');
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.proposeConsensus('nonexistent', 'node-1', 'merge', 'strategy'),
      ).rejects.toThrow('Session not found');
    });

    it('should reject proposal when session is not active', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({ status: 'cancelled' }),
      );

      await expect(
        service.proposeConsensus('session-1', 'node-1', 'merge', 'strategy'),
      ).rejects.toThrow('Session is not active');
    });

    it('should reject proposal from non-member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.proposeConsensus('session-1', 'node-outsider', 'merge', 'strategy'),
      ).rejects.toThrow('Only session members');
    });
  });

  describe('voteConsensus', () => {
    it('should cast a consensus vote', async () => {
      const session = makeSession({
        members: [
          { node_id: 'node-1', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' },
          { node_id: 'node-2', role: 'participant', is_active: true, joined_at: '', last_heartbeat: '' },
        ],
        messages: [],
        vector_clock: {},
      });
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      const result = await service.voteConsensus(
        'session-1', 'proposal-1', 'node-2', 'approve',
      );

      expect(result.vote.vote).toBe('approve');
    });

    it('should reject vote from non-member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.voteConsensus('session-1', 'p1', 'node-outsider', 'approve'),
      ).rejects.toThrow('Only session members');
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.voteConsensus('nonexistent', 'p1', 'node-1', 'approve'),
      ).rejects.toThrow('Session not found');
    });
  });

  describe('heartbeat', () => {
    it('should update member heartbeat', async () => {
      const session = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);

      const result = await service.heartbeat('session-1', 'node-1');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalled();
    });

    it('should reject heartbeat from non-member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.heartbeat('session-1', 'node-outsider'),
      ).rejects.toThrow('not an active member');
    });

    it('should reject heartbeat for non-active session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({ status: 'completed' }),
      );

      await expect(
        service.heartbeat('session-1', 'node-1'),
      ).rejects.toThrow('Session is not active');
    });

    it('should throw NotFoundError when session does not exist', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(
        service.heartbeat('nonexistent', 'node-1'),
      ).rejects.toThrow('Session not found');
    });

    it('should reject concurrent heartbeat updates with a conflict', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      mockPrisma.collaborationSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.heartbeat('session-1', 'node-1')).rejects.toThrow(
        'Session changed; retry',
      );
    });
  });

  describe('getSession', () => {
    it('should return session details', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      const result = await service.getSession('session-1', 'node-1');
      expect(result.id).toBe('session-1');
    });

    it('should throw NotFoundError for missing session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession('nonexistent', 'node-1')).rejects.toThrow('Session not found');
    });

    it('should reject direct session access for non-members', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({
          creator_id: 'node-9',
          members: [{ node_id: 'node-2', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' }],
        }),
      );

      await expect(service.getSession('session-1', 'node-1')).rejects.toThrow(
        'Only session participants can access this session',
      );
    });

    it('should allow the creator to read a cancelled session after leaving', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({
          status: 'cancelled',
          members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
        }),
      );

      const result = await service.getSession('session-1', 'node-1');

      expect(result.status).toBe('cancelled');
    });

    it('should reject a creator who left while the session is still active', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({
          status: 'active',
          members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
        }),
      );

      await expect(service.getSession('session-1', 'node-1')).rejects.toThrow(
        'Only session participants can access this session',
      );
    });

    it('should reject former non-creator members after they leave', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({
          creator_id: 'node-9',
          status: 'cancelled',
          members: [{ node_id: 'node-1', role: 'participant', is_active: false, joined_at: '', last_heartbeat: '' }],
        }),
      );

      await expect(service.getSession('session-1', 'node-1')).rejects.toThrow(
        'Only session participants can access this session',
      );
    });

    it('should reject a creator who left a paused session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession({
          status: 'paused',
          members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
        }),
      );

      await expect(service.getSession('session-1', 'node-1')).rejects.toThrow(
        'Only session participants can access this session',
      );
    });
  });

  describe('listSessions', () => {
    it('should return paginated sessions', async () => {
      mockPrisma.collaborationSession.findMany.mockResolvedValue([makeSession()]);
      mockPrisma.collaborationSession.count.mockResolvedValue(1);

      const result = await service.listSessions({ limit: 10, offset: 0 });
      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.collaborationSession.findMany.mockResolvedValue([]);
      mockPrisma.collaborationSession.count.mockResolvedValue(0);

      await service.listSessions({ status: 'active', limit: 20, offset: 0 });

      expect(mockPrisma.collaborationSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
    });
  });

  describe('listSessionsForNode', () => {
    it('should return sessions readable by the node, including creator-owned historical sessions', async () => {
      mockPrisma.collaborationSession.findMany
        .mockResolvedValueOnce([
          {
            id: 'session-1',
            creator_id: 'node-1',
            status: 'active',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' }],
          },
          {
            id: 'session-2',
            creator_id: 'node-1',
            status: 'cancelled',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
          },
          {
            id: 'session-3',
            creator_id: 'node-2',
            status: 'active',
            members: [{ node_id: 'node-2', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' }],
          },
          {
            id: 'session-4',
            creator_id: 'node-9',
            status: 'cancelled',
            members: [{ node_id: 'node-1', role: 'participant', is_active: false, joined_at: '', last_heartbeat: '' }],
          },
        ])
        .mockResolvedValueOnce([
          makeSession({
            id: 'session-1',
            creator_id: 'node-1',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: true, joined_at: '', last_heartbeat: '' }],
          }),
          makeSession({
            id: 'session-2',
            creator_id: 'node-1',
            status: 'cancelled',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
          }),
        ]);

      const result = await service.listSessionsForNode('node-1', { limit: 10, offset: 0 });

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]?.id).toBe('session-1');
      expect(result.sessions[1]?.id).toBe('session-2');
      expect(result.total).toBe(2);
    });

    it('should apply status filter before membership filtering', async () => {
      mockPrisma.collaborationSession.findMany.mockResolvedValue([]);

      await service.listSessionsForNode('node-1', { status: 'active', limit: 10, offset: 0 });

      expect(mockPrisma.collaborationSession.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          creator_id: true,
          status: true,
          members: true,
        },
      });
    });

    it('should not list active sessions for creators who already left', async () => {
      mockPrisma.collaborationSession.findMany
        .mockResolvedValueOnce([
          {
            id: 'session-1',
            creator_id: 'node-1',
            status: 'active',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
          },
        ])
        .mockResolvedValueOnce([
          makeSession({
            id: 'session-1',
            creator_id: 'node-1',
            status: 'active',
            members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
          }),
        ]);

      const result = await service.listSessionsForNode('node-1', { limit: 10, offset: 0 });

      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getSessionBoard', () => {
    it('should return the persisted board for a session member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          board: {
            items: [{
              id: 'item-1',
              type: 'note',
              content: 'hello',
              created_by: 'node-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            }],
            pinned: ['item-1'],
          },
        },
      }));

      const result = await service.getSessionBoard('session-1', 'node-1');

      expect(result.board.items).toHaveLength(1);
      expect(result.board.pinned).toEqual(['item-1']);
    });

    it('should reject board access for non-members', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      await expect(service.getSessionBoard('session-1', 'node-outsider')).rejects.toThrow(
        'Only session readers can access the session board',
      );
    });

    it('should allow the creator to read board state for a cancelled session after leaving', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        status: 'cancelled',
        members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
        context: {
          board: {
            items: [{ id: 'item-1', type: 'note', content: 'hello', created_by: 'node-1', created_at: '', updated_at: '' }],
            pinned: [],
          },
        },
      }));

      const result = await service.getSessionBoard('session-1', 'node-1');

      expect(result.board.items).toHaveLength(1);
    });
  });

  describe('updateSessionBoard', () => {
    it('should add a board item', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));

      await service.updateSessionBoard(
        'session-1',
        'node-1',
        'add',
        { id: 'item-1', type: 'note', content: 'hello' },
      );

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              board: expect.objectContaining({
                items: expect.arrayContaining([
                  expect.objectContaining({
                    id: 'item-1',
                    type: 'note',
                    content: 'hello',
                    created_by: 'node-1',
                  }),
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should update an existing board item in place', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          board: {
            items: [{
              id: 'item-1',
              type: 'note',
              content: 'old',
              created_by: 'node-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            }],
            pinned: [],
          },
        },
      }));

      await service.updateSessionBoard(
        'session-1',
        'node-1',
        'add',
        { id: 'item-1', type: 'note', content: 'new content' },
      );

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              board: expect.objectContaining({
                items: [expect.objectContaining({ id: 'item-1', content: 'new content' })],
              }),
            }),
          }),
        }),
      );
    });

    it('should pin an existing board item', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          board: {
            items: [{
              id: 'item-1',
              type: 'note',
              content: 'hello',
              created_by: 'node-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            }],
            pinned: [],
          },
        },
      }));
      await service.updateSessionBoard('session-1', 'node-1', 'pin', undefined, 'item-1');

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              board: expect.objectContaining({
                pinned: ['item-1'],
              }),
            }),
          }),
        }),
      );
    });

    it('should remove an existing board item and unpin it', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          board: {
            items: [{
              id: 'item-1',
              type: 'note',
              content: 'hello',
              created_by: 'node-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            }],
            pinned: ['item-1'],
          },
        },
      }));

      await service.updateSessionBoard('session-1', 'node-1', 'remove', undefined, 'item-1');

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              board: { items: [], pinned: [] },
            }),
          }),
        }),
      );
    });

    it('should reject remove without item_id', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(service.updateSessionBoard('session-1', 'node-1', 'remove')).rejects.toThrow(
        'item_id is required for remove',
      );
      expect(mockPrisma.collaborationSession.updateMany).not.toHaveBeenCalled();
    });

    it('should reject add without a complete item payload', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(
        service.updateSessionBoard('session-1', 'node-1', 'add', { id: 'item-1', type: 'note', content: '' }),
      ).rejects.toThrow('item with id, type, and content is required for add');
      expect(mockPrisma.collaborationSession.updateMany).not.toHaveBeenCalled();
    });

    it('should reject pinning unknown items', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(
        service.updateSessionBoard('session-1', 'node-1', 'pin', undefined, 'missing'),
      ).rejects.toThrow('item_id must reference an existing board item');
      expect(mockPrisma.collaborationSession.updateMany).not.toHaveBeenCalled();
    });

    it('should reject pin without item_id', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(service.updateSessionBoard('session-1', 'node-1', 'pin')).rejects.toThrow(
        'item_id is required for pin',
      );
    });

    it('should reject unpin without item_id', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(service.updateSessionBoard('session-1', 'node-1', 'unpin')).rejects.toThrow(
        'item_id is required for unpin',
      );
    });

    it('should reject invalid board actions', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ context: {} }));
      await expect(
        service.updateSessionBoard('session-1', 'node-1', 'archive' as unknown as 'add'),
      ).rejects.toThrow('Invalid board action');
    });

    it('should reject board updates for inactive sessions', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({ status: 'completed' }));
      await expect(
        service.updateSessionBoard('session-1', 'node-1', 'unpin', undefined, 'item-1'),
      ).rejects.toThrow('Session is not active');
    });

    it('should surface session context conflicts on board updates', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          board: {
            items: [{
              id: 'item-1',
              type: 'note',
              content: 'hello',
              created_by: 'node-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            }],
            pinned: [],
          },
        },
      }));
      mockPrisma.collaborationSession.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.updateSessionBoard('session-1', 'node-1', 'pin', undefined, 'item-1'),
      ).rejects.toThrow('Session context changed; retry');
    });
  });

  describe('orchestrateSession', () => {
    it('should persist orchestration metadata in session context', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: { shared_state: { phase: 'planning', orchestrator_id: 'node-1' } },
      }));

      const result = await service.orchestrateSession('session-1', 'node-1', {
        mode: 'parallel',
        task_graph: [{ task_id: 'task-1', depends_on: ['task-0'] }],
        force_converge: true,
      });

      expect(result.mode).toBe('parallel');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              orchestrations: expect.arrayContaining([
                expect.objectContaining({
                  mode: 'parallel',
                  task_graph: [{ task_id: 'task-1', depends_on: ['task-0'] }],
                  force_converge: true,
                }),
              ]),
              shared_state: expect.objectContaining({
                phase: 'planning',
                orchestrator_id: 'node-1',
                orchestration_mode: 'parallel',
              }),
            }),
          }),
        }),
      );
    });

    it('should reject orchestration by non-members', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      await expect(
        service.orchestrateSession('session-1', 'node-outsider', { mode: 'parallel' }),
      ).rejects.toThrow('Only session members can orchestrate the session');
    });

    it('should reject orchestration by non-orchestrators', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: { shared_state: { orchestrator_id: 'node-2' } },
      }));
      await expect(
        service.orchestrateSession('session-1', 'node-1', { mode: 'parallel' }),
      ).rejects.toThrow('Only the session orchestrator can orchestrate the session');
    });

    it('should reject orchestration without directives', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: { shared_state: { orchestrator_id: 'node-1' } },
      }));
      await expect(
        service.orchestrateSession('session-1', 'node-1', {}),
      ).rejects.toThrow('At least one orchestration directive is required');
    });
  });

  describe('submitSessionResult', () => {
    it('should persist submissions in session context', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: { shared_state: { phase: 'review' } },
      }));

      const result = await service.submitSessionResult(
        'session-1',
        'node-1',
        'task-1',
        'sha256:asset-1',
        { result: { outcome: 'done' }, summary: ' completed ' },
      );

      expect(result.summary).toBe('completed');
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              submissions: expect.arrayContaining([
                expect.objectContaining({
                  task_id: 'task-1',
                  result_asset_id: 'sha256:asset-1',
                  submitted_by: 'node-1',
                  result: { outcome: 'done' },
                  summary: 'completed',
                }),
              ]),
              shared_state: expect.objectContaining({
                phase: 'review',
                latest_submission_by: 'node-1',
                latest_submission_task_id: 'task-1',
                latest_submission_asset_id: 'sha256:asset-1',
                latest_submission_summary: 'completed',
              }),
            }),
          }),
        }),
      );
    });

    it('should reject submission by non-members', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      await expect(
        service.submitSessionResult('session-1', 'node-outsider', 'task-1', 'sha256:asset-1'),
      ).rejects.toThrow('Only session members can submit session results');
    });

    it('should clear stale latest submission summary when a new summary is omitted', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          shared_state: {
            latest_submission_summary: 'old summary',
          },
        },
      }));

      await service.submitSessionResult('session-1', 'node-1', 'task-2', 'sha256:asset-2');

      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              shared_state: expect.objectContaining({
                latest_submission_task_id: 'task-2',
                latest_submission_asset_id: 'sha256:asset-2',
                latest_submission_summary: null,
              }),
            }),
          }),
        }),
      );
    });

    it('should treat whitespace-only summaries as missing', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        context: {
          shared_state: {
            latest_submission_summary: 'old summary',
          },
        },
      }));

      const result = await service.submitSessionResult(
        'session-1',
        'node-1',
        'task-3',
        'sha256:asset-3',
        { summary: '   ' },
      );

      expect(result.summary).toBeUndefined();
      expect(mockPrisma.collaborationSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            context: expect.objectContaining({
              submissions: expect.arrayContaining([
                expect.not.objectContaining({ summary: expect.anything() }),
              ]),
              shared_state: expect.objectContaining({
                latest_submission_summary: null,
              }),
            }),
          }),
        }),
      );
    });

    it('should reject blank task or asset identifiers', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());

      await expect(
        service.submitSessionResult('session-1', 'node-1', '   ', 'sha256:asset-1'),
      ).rejects.toThrow('task_id and result_asset_id are required');
      await expect(
        service.submitSessionResult('session-1', 'node-1', 'task-1', '   '),
      ).rejects.toThrow('task_id and result_asset_id are required');
      expect(mockPrisma.collaborationSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getSessionContext', () => {
    it('should return limited messages, participants, and persisted context', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        members: [
          {
            node_id: 'node-1',
            role: 'organizer',
            joined_at: '',
            last_heartbeat: '',
            is_active: true,
          },
          {
            node_id: 'node-2',
            role: 'participant',
            joined_at: '',
            last_heartbeat: '',
            is_active: false,
          },
        ],
        messages: [
          { id: 'msg-1', content: 'one' },
          { id: 'msg-2', content: 'two' },
          { id: 'msg-3', content: 'three' },
        ],
        context: {
          shared_state: { phase: 'active' },
          board: { items: [{ id: 'item-1', type: 'note', content: 'hello' }], pinned: [] },
          orchestrations: [{ orchestration_id: 'orch-1', mode: 'parallel' }],
          submissions: [{ submission_id: 'sub-1', submitted_by: 'node-1' }],
        },
      }));

      const result = await service.getSessionContext('session-1', 'node-1', 2);

      expect(result.messages).toEqual([
        { id: 'msg-2', content: 'two' },
        { id: 'msg-3', content: 'three' },
      ]);
      expect(result.participants).toEqual([
        expect.objectContaining({ node_id: 'node-1', is_active: true }),
      ]);
      expect(result.shared_state).toEqual({ phase: 'active' });
      expect(result.orchestrations).toHaveLength(1);
      expect(result.submissions).toHaveLength(1);
    });

    it('should reject context access for non-members', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession());
      await expect(service.getSessionContext('session-1', 'node-outsider')).rejects.toThrow(
        'Only session readers can access the session context',
      );
    });

    it('should allow the creator to read historical context after leaving a completed session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(makeSession({
        status: 'completed',
        members: [{ node_id: 'node-1', role: 'organizer', is_active: false, joined_at: '', last_heartbeat: '' }],
        context: {
          shared_state: { phase: 'done' },
        },
      }));

      const result = await service.getSessionContext('session-1', 'node-1');

      expect(result.shared_state).toEqual({ phase: 'done' });
      expect(result.participants).toEqual([]);
    });
  });

  describe('expireSessions', () => {
    it('should expire past sessions', async () => {
      mockPrisma.collaborationSession.findMany.mockResolvedValue([
        { id: 's1', status: 'active' },
      ]);
      mockPrisma.collaborationSession.update.mockResolvedValue({ id: 's1', status: 'expired' });

      const result = await service.expireSessions();
      expect(result.expired_count).toBe(1);
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'expired' }),
        }),
      );
    });

    it('should return 0 if no sessions to expire', async () => {
      mockPrisma.collaborationSession.findMany.mockResolvedValue([]);

      const result = await service.expireSessions();
      expect(result.expired_count).toBe(0);
    });
  });
});
