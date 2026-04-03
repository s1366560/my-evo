import * as service from './service';

const mockPrisma = {
  collaborationSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
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
      mockPrisma.collaborationSession.update.mockResolvedValue({
        ...mockSession,
        members: [
          ...mockSession.members,
          {
            node_id: 'node-2',
            role: 'participant',
            joined_at: expect.any(String),
            last_heartbeat: expect.any(String),
            is_active: true,
          },
        ],
      });

      const result = await service.joinSession('session-1', 'node-2');
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalled();
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
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      await service.leaveSession('session-1', 'node-2');
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalledWith(
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
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      await service.leaveSession('session-1', 'node-1');
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalledWith(
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
  });

  describe('sendMessage', () => {
    it('should send a message and update vector clock', async () => {
      const session = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      const result = await service.sendMessage(
        'session-1', 'node-1', 'query', 'Hello world',
      );

      expect(result.message).toBeDefined();
      expect(result.message.content).toBe('Hello world');
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalledWith(
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
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      await service.sendMessage('session-1', 'node-1', 'query', 'msg');

      expect(mockPrisma.collaborationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vector_clock: { 'node-1': 3 },
          }),
        }),
      );
    });

    it('should reject message from non-member', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      await expect(
        service.sendMessage('session-1', 'node-outsider', 'query', 'msg'),
      ).rejects.toThrow('Only session members');
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
  });

  describe('heartbeat', () => {
    it('should update member heartbeat', async () => {
      const session = makeSession();
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(session);
      mockPrisma.collaborationSession.update.mockResolvedValue(session);

      const result = await service.heartbeat('session-1', 'node-1');
      expect(mockPrisma.collaborationSession.update).toHaveBeenCalled();
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
  });

  describe('getSession', () => {
    it('should return session details', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(
        makeSession(),
      );

      const result = await service.getSession('session-1');
      expect(result.id).toBe('session-1');
    });

    it('should throw NotFoundError for missing session', async () => {
      mockPrisma.collaborationSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession('nonexistent')).rejects.toThrow('Session not found');
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
