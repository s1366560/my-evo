const { authenticate, authenticateNodeSecretBearer, checkQuarantine, requireAuth, requireTrustLevel, requireNodeSecretAuth, requireNoActiveQuarantine, requireScope } = require('./auth');
const { UnauthorizedError, ForbiddenError, TrustLevelError, QuarantineError } = require('./errors');
const future = new Date(Date.now() + 60000);
const past = new Date(Date.now() - 60000);
const db = () => ({ userSession: { findUnique: jest.fn() }, apiKey: { findFirst: jest.fn() }, node: { findFirst: jest.fn() }, quarantineRecord: { findFirst: jest.fn() } });

describe('shared/auth', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('authenticate() session', () => {
    it('authenticates valid cookie session', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 't', expires_at: future, user: { id: 'u1', node_id: 'n1', trust_level: 'verified' } });
      expect(await authenticate({ cookies: { session_token: 't' }, headers: {}, server: { prisma: m } })).toMatchObject({ node_id: 'n1', auth_type: 'session' });
    });
    it('authenticates x-session-token header', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'h', expires_at: future, user: { id: 'u2', node_id: 'n2', trust_level: 'trusted' } });
      expect((await authenticate({ cookies: {}, headers: { 'x-session-token': 'h' }, server: { prisma: m } })).auth_type).toBe('session');
    });
    it('prefers cookie over header', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'c', expires_at: future, user: { id: 'u3', node_id: 'n3', trust_level: 'verified' } });
      await authenticate({ cookies: { session_token: 'c' }, headers: { 'x-session-token': 'h' }, server: { prisma: m } });
      expect(m.userSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { token: 'c' } }));
    });
    it('rejects invalid session', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue(null);
      await expect(authenticate({ cookies: { session_token: 'x' }, headers: {}, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('rejects expired session', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'e', expires_at: past, user: { id: 'u4', node_id: 'n4', trust_level: 'verified' } });
      await expect(authenticate({ cookies: { session_token: 'e' }, headers: {}, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('generates user-{id} when node_id null', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'n', expires_at: future, user: { id: 'uid', node_id: null, trust_level: 'unverified' } });
      expect((await authenticate({ cookies: { session_token: 'n' }, headers: {}, server: { prisma: m } })).node_id).toBe('user-uid');
    });
  });

  describe('authenticate() node secret', () => {
    it('authenticates valid secret', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue({ node_id: 'ns1', trust_level: 'verified' });
      expect(await authenticate({ cookies: {}, headers: { authorization: 'Bearer s' }, server: { prisma: m } })).toMatchObject({ node_id: 'ns1', auth_type: 'node_secret' });
    });
    it('rejects invalid secret', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue(null);
      await expect(authenticate({ cookies: {}, headers: { authorization: 'Bearer x' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('ignores bearer when session present', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'ses', expires_at: future, user: { id: 'u6', node_id: 'n6', trust_level: 'verified' } });
      expect((await authenticate({ cookies: { session_token: 'ses' }, headers: { authorization: 'Bearer sec' }, server: { prisma: m } })).auth_type).toBe('session');
    });
  });

  describe('authenticate() API key (ek_)', () => {
    it('authenticates valid ek_ key', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: future, scopes: ['read'], user: { id: 'u7', node_id: 'n7', trust_level: 'trusted' } });
      expect(await authenticate({ cookies: {}, headers: { authorization: 'Bearer ek_k' }, server: { prisma: m } })).toMatchObject({ node_id: 'n7', auth_type: 'api_key', scopes: ['read'] });
    });
    it('rejects expired key', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: past, scopes: ['read'], user: { id: 'u8', node_id: 'n8', trust_level: 'verified' } });
      await expect(authenticate({ cookies: {}, headers: { authorization: 'Bearer ek_e' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('rejects invalid key', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue(null);
      await expect(authenticate({ cookies: {}, headers: { authorization: 'Bearer ek_x' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('allows key with no expiry', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: null, scopes: ['read'], user: { id: 'u9', node_id: 'n9', trust_level: 'verified' } });
      expect((await authenticate({ cookies: {}, headers: { authorization: 'Bearer ek_ne' }, server: { prisma: m } })).auth_type).toBe('api_key');
    });
  });

  describe('authenticate() no credentials', () => {
    it('throws UnauthorizedError with empty auth', async () => {
      const m = db();
      await expect(authenticate({ cookies: {}, headers: {}, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('throws for non-Bearer auth', async () => {
      const m = db();
      await expect(authenticate({ cookies: {}, headers: { authorization: 'Basic x' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('requireTrustLevel()', () => {
    it('allows request with sufficient trust level (verified >= verified)', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'vs', expires_at: future, user: { id: 't1', node_id: 'nt1', trust_level: 'verified' } });
      const mw = requireTrustLevel('verified'); const req: any = { cookies: { session_token: 'vs' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.trust_level).toBe('verified');
    });
    it('allows higher trust level (trusted >= verified)', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'ts', expires_at: future, user: { id: 't2', node_id: 'nt2', trust_level: 'trusted' } });
      const mw = requireTrustLevel('verified'); const req: any = { cookies: { session_token: 'ts' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.trust_level).toBe('trusted');
    });
    it('rejects insufficient trust level (unverified < verified)', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'us', expires_at: future, user: { id: 't3', node_id: 'nt3', trust_level: 'unverified' } });
      const mw = requireTrustLevel('verified'); const req: any = { cookies: { session_token: 'us' }, headers: {}, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(TrustLevelError);
    });
    it('rejects verified when trusted required', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'vs2', expires_at: future, user: { id: 't4', node_id: 'nt4', trust_level: 'verified' } });
      const mw = requireTrustLevel('trusted'); const req: any = { cookies: { session_token: 'vs2' }, headers: {}, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(TrustLevelError);
    });
    it('allows unverified to access unverified-only endpoints', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'un1', expires_at: future, user: { id: 't5', node_id: 'nt5', trust_level: 'unverified' } });
      const mw = requireTrustLevel('unverified'); const req: any = { cookies: { session_token: 'un1' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.trust_level).toBe('unverified');
    });
  });

  describe('requireNodeSecretAuth()', () => {
    it('authenticates valid node secret bearer', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue({ node_id: 'ns2', trust_level: 'verified' });
      const mw = requireNodeSecretAuth(); const req: any = { headers: { authorization: 'Bearer ns_secret' }, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.auth_type).toBe('node_secret');
    });
    it('rejects missing auth header', async () => {
      const m = db(); const mw = requireNodeSecretAuth(); const req: any = { headers: {}, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(UnauthorizedError);
    });
    it('rejects ek_ API key', async () => {
      const m = db(); const mw = requireNodeSecretAuth(); const req: any = { headers: { authorization: 'Bearer ek_k' }, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(UnauthorizedError);
    });
    it('rejects invalid node secret', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue(null); const mw = requireNodeSecretAuth();
      const req: any = { headers: { authorization: 'Bearer bad' }, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('checkQuarantine()', () => {
    it('passes when no active quarantine', async () => {
      const m = db(); m.quarantineRecord.findFirst.mockResolvedValue(null);
      await expect(checkQuarantine('node-q1', m)).resolves.toBeUndefined();
      expect(m.quarantineRecord.findFirst).toHaveBeenCalledWith({ where: { node_id: 'node-q1', is_active: true } });
    });
    it('throws QuarantineError when quarantined', async () => {
      const m = db(); m.quarantineRecord.findFirst.mockResolvedValue({ level: 'L2', is_active: true });
      await expect(checkQuarantine('node-q2', m)).rejects.toThrow(QuarantineError);
    });
  });

  describe('requireNoActiveQuarantine()', () => {
    it('passes when no quarantine and no pre-existing auth', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'q1', expires_at: future, user: { id: 'quser1', node_id: 'qnode1', trust_level: 'verified' } });
      m.quarantineRecord.findFirst.mockResolvedValue(null);
      const mw = requireNoActiveQuarantine(); const req: any = { cookies: { session_token: 'q1' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.node_id).toBe('qnode1');
    });
    it('rejects when quarantined after auth', async () => {
      const m = db(); m.quarantineRecord.findFirst.mockResolvedValue({ level: 'L1' });
      const mw = requireNoActiveQuarantine(); const req: any = { auth: { node_id: 'qnode2', auth_type: 'session', trust_level: 'verified' as const }, cookies: {}, headers: {}, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(QuarantineError);
    });
  });

  describe('requireScope()', () => {
    it('allows api_key with required scope', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: future, scopes: ['write', 'read'], user: { id: 'sc1', node_id: 'nsc1', trust_level: 'verified' } });
      const mw = requireScope('write'); const req: any = { cookies: {}, headers: { authorization: 'Bearer ek_sc' }, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.auth_type).toBe('api_key');
    });
    it('allows api_key with read scope for any request', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: future, scopes: ['read'], user: { id: 'sc2', node_id: 'nsc2', trust_level: 'verified' } });
      const mw = requireScope('write'); const req: any = { cookies: {}, headers: { authorization: 'Bearer ek_sc2' }, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.auth_type).toBe('api_key');
    });
    it('rejects api_key without required scope or read wildcard', async () => {
      const m = db(); m.apiKey.findFirst.mockResolvedValue({ expires_at: future, scopes: ['write'], user: { id: 'sc3', node_id: 'nsc3', trust_level: 'verified' } });
      const mw = requireScope('delete'); const req: any = { cookies: {}, headers: { authorization: 'Bearer ek_sc3' }, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(ForbiddenError);
    });
    it('allows session auth without scope check', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'sess4', expires_at: future, user: { id: 'sc4', node_id: 'nsc4', trust_level: 'verified' } });
      const mw = requireScope('delete'); const req: any = { cookies: { session_token: 'sess4' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth.auth_type).toBe('session');
    });
  });

  describe('requireAuth()', () => {
    it('authenticates valid session', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue({ token: 'ra1', expires_at: future, user: { id: 'ra1', node_id: 'nra1', trust_level: 'verified' } });
      const mw = requireAuth(); const req: any = { cookies: { session_token: 'ra1' }, headers: {}, server: { prisma: m } };
      await mw(req, {}); expect(req.auth).toBeDefined();
    });
    it('rejects invalid session', async () => {
      const m = db(); m.userSession.findUnique.mockResolvedValue(null);
      const mw = requireAuth(); const req: any = { cookies: { session_token: 'bad' }, headers: {}, server: { prisma: m } };
      await expect(mw(req, {})).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('authenticateNodeSecretBearer()', () => {
    it('authenticates valid bearer token', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue({ node_id: 'b1', trust_level: 'verified' });
      const r = await authenticateNodeSecretBearer({ headers: { authorization: 'Bearer ns_b1' }, server: { prisma: m } });
      expect(r).toMatchObject({ node_id: 'b1', auth_type: 'node_secret' });
    });
    it('rejects non-Bearer auth', async () => {
      const m = db();
      await expect(authenticateNodeSecretBearer({ headers: { authorization: 'Basic x' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('rejects ek_ prefix', async () => {
      const m = db();
      await expect(authenticateNodeSecretBearer({ headers: { authorization: 'Bearer ek_k' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
    it('rejects invalid bearer', async () => {
      const m = db(); m.node.findFirst.mockResolvedValue(null);
      await expect(authenticateNodeSecretBearer({ headers: { authorization: 'Bearer bad' }, server: { prisma: m } })).rejects.toThrow(UnauthorizedError);
    });
  });
});
