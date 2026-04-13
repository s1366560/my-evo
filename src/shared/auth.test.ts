import {
  authenticate,
  checkQuarantine,
  requireAuth,
} from './auth';
import {
  QuarantineError,
  UnauthorizedError,
} from './errors';

describe('shared/auth', () => {
  const futureDate = new Date(Date.now() + 60_000);
  const pastDate = new Date(Date.now() - 60_000);

  function createMockPrisma() {
    return {
      userSession: {
        findUnique: jest.fn(),
      },
      apiKey: {
        findFirst: jest.fn(),
      },
      node: {
        findFirst: jest.fn(),
      },
      quarantineRecord: {
        findFirst: jest.fn(),
      },
    };
  }

  it('authenticates session tokens with the injected request Prisma client', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.userSession.findUnique.mockResolvedValue({
      token: 'session-token',
      expires_at: futureDate,
      user: {
        id: 'user-1',
        node_id: 'node-1',
        trust_level: 'verified',
      },
    });

    const result = await authenticate({
      cookies: { session_token: 'session-token' },
      headers: {},
      server: { prisma: mockPrisma },
    } as any);

    expect(mockPrisma.userSession.findUnique).toHaveBeenCalledWith({
      where: { token: 'session-token' },
      include: { user: true },
    });
    expect(result).toMatchObject({
      node_id: 'node-1',
      userId: 'user-1',
      trust_level: 'verified',
      auth_type: 'session',
    });
  });

  it('authenticates ek_ API keys with the injected request Prisma client', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      key_hash: 'hash',
      expires_at: futureDate,
      scopes: ['read'],
      user: {
        id: 'user-2',
        node_id: 'node-2',
        trust_level: 'trusted',
      },
    });

    const request = {
      cookies: {},
      headers: { authorization: 'Bearer ek_test_key' },
      server: { prisma: mockPrisma },
    } as any;

    const result = await authenticate(request);
    const preHandler = requireAuth();
    await preHandler(request, {} as any);

    expect(mockPrisma.apiKey.findFirst).toHaveBeenCalled();
    expect(result).toMatchObject({
      node_id: 'node-2',
      userId: 'user-2',
      trust_level: 'trusted',
      auth_type: 'api_key',
      scopes: ['read'],
    });
    expect(request.auth).toMatchObject({
      node_id: 'node-2',
      auth_type: 'api_key',
    });
  });

  it('rejects expired sessions', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.userSession.findUnique.mockResolvedValue({
      token: 'expired-session',
      expires_at: pastDate,
      user: {
        id: 'user-3',
        node_id: 'node-3',
        trust_level: 'unverified',
      },
    });

    await expect(authenticate({
      cookies: { session_token: 'expired-session' },
      headers: {},
      server: { prisma: mockPrisma },
    } as any)).rejects.toThrow(UnauthorizedError);
  });

  it('checks quarantine with the injected Prisma client', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
      level: 'L2',
    });

    await expect(checkQuarantine('node-4', mockPrisma as any)).rejects.toThrow(QuarantineError);
    expect(mockPrisma.quarantineRecord.findFirst).toHaveBeenCalledWith({
      where: { node_id: 'node-4', is_active: true },
    });
  });
});
