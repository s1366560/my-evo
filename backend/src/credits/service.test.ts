// Credits edge-case coverage + Prisma-path coverage boost.
import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mockStore } from '../db/mock-store.js';
import { assetService } from '../assets/service.js';
import { authService } from '../auth/service.js';
import { oauthService } from '../oauth/service.js';
import { config } from '../config/index.js';
import { __resetOAuthStateStore } from '../oauth/state.js';

beforeAll(() => { delete process.env.DATABASE_URL; });

async function seedUser(email: string, name: string, credits: number) {
  const hashed = await bcrypt.hash('Password123!', 4);
  return mockStore.createUser({ email, password: hashed, name, level: 1, reputation: 0, credits });
}

function makeUser(overrides: any = {}) {
  return {
    id: 'user_p1', email: 'prisma@e.com', password: 'h', name: 'Prisma User',
    role: 'user', level: 1, reputation: 0, credits: 100, avatar: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function makeAsset(overrides: any = {}) {
  return {
    id: 'asset_p1', title: 'P Asset', description: 'desc', type: 'Gene', kind: 'strategy',
    published: false, status: 'draft', price: 50, publishedVersionId: null,
    authorId: 'user_p1', nodeId: null, metadata: {}, content: 'hello', url: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

beforeEach(() => {
  mockStore.clear();
  __resetOAuthStateStore();
});

describe('Credits edge cases (mock mode)', () => {
  let author: any;
  let buyer: any;
  beforeEach(async () => {
    author = await seedUser('cauthor@e.com', 'CA', 0);
    buyer = await seedUser('cbuyer@e.com', 'CB', 1000);
  });

  test('register creates a user with zero initial credits', async () => {
    const r = await authService.register({ email: 'zr@example.com', password: 'ZeroBal1!', name: 'Zero' });
    expect(r.user.credits).toBe(0);
  });

  test('purchasing a free asset leaves both balances unchanged', async () => {
    const a = await assetService.createAsset(author.id, { title: 'Free', type: 'Gene', price: 0 });
    await assetService.publishAsset(author.id, a.id, {});
    const buyerBefore = (await mockStore.findUserById(buyer.id))!.credits;
    const authorBefore = (await mockStore.findUserById(author.id))!.credits;
    const r = await assetService.purchaseAsset(buyer.id, a.id, {});
    expect(r.pricePaid).toBe(0);
    expect((await mockStore.findUserById(buyer.id))!.credits).toBe(buyerBefore);
    expect((await mockStore.findUserById(author.id))!.credits).toBe(authorBefore);
  });

  test('purchasing at the maximum price zeros the buyer balance', async () => {
    const a = await assetService.createAsset(author.id, { title: 'Costly', type: 'Capsule', price: 1000 });
    await assetService.publishAsset(author.id, a.id, {});
    await assetService.purchaseAsset(buyer.id, a.id, {});
    expect((await mockStore.findUserById(buyer.id))!.credits).toBe(0);
    expect((await mockStore.findUserById(author.id))!.credits).toBe(1000);
  });

  test('two purchases accumulate to the author credits', async () => {
    const a = await assetService.createAsset(author.id, { title: 'A', type: 'Recipe', price: 200 });
    await assetService.publishAsset(author.id, a.id, {});
    await assetService.purchaseAsset(buyer.id, a.id, {});
    await assetService.purchaseAsset(buyer.id, a.id, { idempotencyKey: 'k2' });
    expect((await mockStore.findUserById(author.id))!.credits).toBe(400);
    expect((await mockStore.findUserById(buyer.id))!.credits).toBe(600);
  });

  test('a manually stored negative balance is preserved by the store', async () => {
    await mockStore.updateUser(buyer.id, { credits: -50 });
    const u = await mockStore.findUserById(buyer.id);
    expect(u!.credits).toBe(-50);
  });

  test('reviewing a published asset computes the avg rating', async () => {
    const a = await assetService.createAsset(author.id, { title: 'R', type: 'Gene' });
    await assetService.publishAsset(author.id, a.id, {});
    const r = await assetService.createReview(buyer.id, a.id, { rating: 4, comment: 'good' });
    expect(r.rating).toBe(4);
    const detail = await assetService.getAsset(a.id);
    expect(detail.reviewCount).toBe(1);
    expect(detail.avgRating).toBeCloseTo(4, 1);
  });
});

async function withIsolatedPrisma<T>(fake: any, run: (mods: { a: any, o: any, s: any }) => Promise<T>): Promise<T> {
  let result!: T;
  await jest.isolateModulesAsync(async () => {
    jest.doMock('../db/index.js', () => ({
      prisma: fake,
      isMockMode: () => fake === null,
      getPrisma: () => fake,
    }));
    const a = (await import('../auth/service.js')).authService;
    const o = (await import('../oauth/service.js')).oauthService;
    const s = (await import('../assets/service.js')).assetService;
    result = await run({ a, o, s });
  });
  return result;
}

describe('authService Prisma branches', () => {
  test('register rejects duplicate email via Prisma', async () => {
    await withIsolatedPrisma({
      user: { findUnique: async () => makeUser(), create: async () => makeUser() },
    }, async ({ a }) => {
      await expect(a.register({ email: 'prisma@e.com', password: 'Password123!', name: 'X' })).rejects.toThrow(/already registered/i);
    });
  });

  test('register creates a user when email is new (Prisma path)', async () => {
    await withIsolatedPrisma({
      user: { findUnique: async () => null, create: async () => makeUser() },
    }, async ({ a }) => {
      const r = await a.register({ email: 'prisma@e.com', password: 'Password123!', name: 'X' });
      expect(r.user.email).toBe('prisma@e.com');
      expect(r.accessToken).toBeTruthy();
    });
  });

  test('login rejects unknown email via Prisma', async () => {
    await withIsolatedPrisma({ user: { findUnique: async () => null } }, async ({ a }) => {
      await expect(a.login({ email: 'nope@e.com', password: 'Password123!' })).rejects.toThrow(/invalid credentials/i);
    });
  });

  test('login rejects wrong password via Prisma', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('RightPass1!', 4);
    await withIsolatedPrisma({ user: { findUnique: async () => makeUser({ password: hash }) } }, async ({ a }) => {
      await expect(a.login({ email: 'prisma@e.com', password: 'WrongPass1!' })).rejects.toThrow(/invalid credentials/i);
    });
  });

  test('login succeeds when password matches (Prisma path)', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('RightPass1!', 4);
    await withIsolatedPrisma({ user: { findUnique: async () => makeUser({ password: hash }) } }, async ({ a }) => {
      const r = await a.login({ email: 'prisma@e.com', password: 'RightPass1!' });
      expect(r.user.email).toBe('prisma@e.com');
    });
  });

  test('refreshToken issues a new access token (Prisma path)', async () => {
    const t = jwt.sign({ userId: 'user_p1', email: 'p@e.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    await withIsolatedPrisma({ user: { findUnique: async () => makeUser() } }, async ({ a }) => {
      const r = await a.refreshToken(t);
      expect(r.accessToken).toBeTruthy();
    });
  });

  test('refreshToken rejects when user is missing (Prisma path)', async () => {
    const t = jwt.sign({ userId: 'user_p1', email: 'p@e.com', role: 'user' }, config.jwtSecret, { expiresIn: '1h' });
    await withIsolatedPrisma({ user: { findUnique: async () => null } }, async ({ a }) => {
      await expect(a.refreshToken(t)).rejects.toThrow(/invalid refresh token/i);
    });
  });

  test('forgotPassword returns null when user not found (Prisma path)', async () => {
    await withIsolatedPrisma({ user: { findUnique: async () => null } }, async ({ a }) => {
      const r = await a.forgotPassword('nope@e.com');
      expect(r.resetToken).toBeNull();
      expect(r.expiresAt).toBeInstanceOf(Date);
    });
  });

  test('forgotPassword issues a token (Prisma path)', async () => {
    await withIsolatedPrisma({
      user: { findUnique: async () => makeUser() },
      passwordResetToken: {
        deleteMany: async () => { throw new Error('model not present'); },
        create: async () => ({ id: 'prt1', userId: 'user_p1', tokenHash: 'h', expiresAt: new Date(), usedAt: null }),
      },
    }, async ({ a }) => {
      const r = await a.forgotPassword('prisma@e.com');
      expect(r.resetToken).toBeTruthy();
    });
  });
});

describe('resetPassword Prisma branches', () => {
  test('rejects empty token', async () => {
    await withIsolatedPrisma({}, async ({ a }) => {
      await expect(a.resetPassword('', 'NewPass1!')).rejects.toThrow(/token/i);
    });
  });

  test('rejects weak password', async () => {
    await withIsolatedPrisma({}, async ({ a }) => {
      await expect(a.resetPassword('a.b', 'short')).rejects.toThrow(/at least 8/i);
    });
  });

  test('rejects unknown token', async () => {
    await withIsolatedPrisma({
      passwordResetToken: { findUnique: async () => null, findFirst: async () => null },
    }, async ({ a }) => {
      await expect(a.resetPassword('rec.bogus', 'NewPass1!')).rejects.toThrow(/invalid or expired/i);
    });
  });

  test('rejects used token', async () => {
    const used = { id: 'r1', userId: 'user_p1', tokenHash: 'h', expiresAt: new Date(Date.now() + 60000), usedAt: new Date() };
    await withIsolatedPrisma({
      passwordResetToken: { findUnique: async () => used, findFirst: async () => used },
    }, async ({ a }) => {
      await expect(a.resetPassword('r1.tok', 'NewPass1!')).rejects.toThrow(/already been used/i);
    });
  });

  test('rejects expired token', async () => {
    const exp = { id: 'r2', userId: 'user_p1', tokenHash: 'h', expiresAt: new Date(Date.now() - 1000), usedAt: null };
    await withIsolatedPrisma({
      passwordResetToken: { findUnique: async () => exp, findFirst: async () => exp },
    }, async ({ a }) => {
      await expect(a.resetPassword('r2.tok', 'NewPass1!')).rejects.toThrow(/expired/i);
    });
  });

  test('succeeds and updates user', async () => {
    let updatedUser = false; let markedUsed = false;
    const rec = { id: 'r3', userId: 'user_p1', tokenHash: 'h', expiresAt: new Date(Date.now() + 60000), usedAt: null };
    await withIsolatedPrisma({
      passwordResetToken: { findUnique: async () => rec, findFirst: async () => rec, update: async () => { markedUsed = true; return rec; } },
      user: { update: async () => { updatedUser = true; return makeUser(); } },
    }, async ({ a }) => {
      const r = await a.resetPassword('r3.tok', 'BrandNew1!');
      expect(r.userId).toBeTruthy();
      expect(updatedUser).toBe(true);
      expect(markedUsed).toBe(true);
    });
  });

  test('falls back to hash lookup when record id is empty', async () => {
    const rec = { id: 'r4', userId: 'user_p1', tokenHash: 'h', expiresAt: new Date(Date.now() + 60000), usedAt: null };
    await withIsolatedPrisma({
      passwordResetToken: { findUnique: async () => null, findFirst: async () => rec, update: async () => rec },
      user: { update: async () => makeUser() },
    }, async ({ a }) => {
      const r = await a.resetPassword('justplaintext', 'NewPass1!');
      expect(r.userId).toBeTruthy();
    });
  });
});

describe('assetService Prisma branches', () => {
  test('createAsset creates a draft via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { create: async () => makeAsset() },
    }, async ({ s }) => {
      const r = await s.createAsset('user_p1', { title: 'P Asset', type: 'Gene' });
      expect(r.id).toBe('asset_p1');
    });
  });

  test('getAsset returns asset via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => ({ ...makeAsset(), versions: [] }) },
      $queryRawUnsafe: async () => [{ _avg: 4.5, _count: 2 }],
    }, async ({ s }) => {
      const r = await s.getAsset('asset_p1');
      expect(r.id).toBe('asset_p1');
    });
  });

  test('getAsset tolerates $queryRawUnsafe error', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => ({ ...makeAsset(), versions: [] }) },
      $queryRawUnsafe: async () => { throw new Error('raw query fail'); },
    }, async ({ s }) => {
      const r = await s.getAsset('asset_p1');
      expect(r.id).toBe('asset_p1');
      expect(r.avgRating).toBe(0);
    });
  });

  test('getAsset returns 404 for unknown via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => null },
    }, async ({ s }) => {
      await expect(s.getAsset('unknown')).rejects.toThrow(/not found/i);
    });
  });

  test('listAssets returns assets via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findMany: async () => [makeAsset()], count: async () => 1 },
    }, async ({ s }) => {
      const r = await s.listAssets({ page: 1, limit: 20 });
      expect(r.data.length).toBe(1);
      expect(r.pagination.total).toBe(1);
    });
  });

  test('updateAsset updates via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => makeAsset(), update: async () => makeAsset({ title: 'Updated' }) },
    }, async ({ s }) => {
      const r = await s.updateAsset('user_p1', 'asset_p1', { title: 'Updated' });
      expect(r.title).toBe('Updated');
    });
  });

  test('updateAsset rejects non-author via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => makeAsset({ authorId: 'other_user' }) },
    }, async ({ s }) => {
      await expect(s.updateAsset('user_p1', 'asset_p1', { title: 'Hacked' })).rejects.toThrow(/not your asset/i);
    });
  });

  test('updateAsset rejects non-existent via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => null },
    }, async ({ s }) => {
      await expect(s.updateAsset('user_p1', 'unknown', { title: 'X' })).rejects.toThrow(/not found/i);
    });
  });

  test('publishAsset creates version via Prisma', async () => {
    const a = { ...makeAsset({ published: false }), versions: [] };
    await withIsolatedPrisma({
      asset: { findUnique: async () => a, update: async () => makeAsset({ published: true }) },
      assetVersion: { create: async () => ({ id: 'v1', assetId: 'asset_p1', versionNo: 1, steps: [] }) },
    }, async ({ s }) => {
      const r = await s.publishAsset('user_p1', 'asset_p1', {});
      expect(r).toBeTruthy();
    });
  });

  test('publishAsset rejects non-author via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => ({ ...makeAsset({ authorId: 'other_user' }), versions: [] }) },
    }, async ({ s }) => {
      await expect(s.publishAsset('user_p1', 'asset_p1', {})).rejects.toThrow(/not your asset/i);
    });
  });

  test('purchaseAsset deducts credits via Prisma', async () => {
    const a = makeAsset({ published: true, price: 50, authorId: 'author1', publishedVersionId: 'v1' });
    await withIsolatedPrisma({
      asset: { findUnique: async () => a },
      assetPurchase: { findUnique: async () => null, create: async () => ({ id: 'p1', assetId: 'asset_p1', userId: 'buyer1', pricePaid: 50, status: 'completed', idempotencyKey: null }) },
      user: {
        findUnique: async (args: any) => args.where.id === 'buyer1' ? { id: 'buyer1', credits: 200 } : { id: 'author1', credits: 0 },
        update: async (args: any) => ({ id: args.where.id, credits: 100 }),
      },
    }, async ({ s }) => {
      const r = await s.purchaseAsset('buyer1', 'asset_p1', {});
      expect(r.pricePaid).toBe(50);
    });
  });

  test('recycleAsset sets status via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => makeAsset({ authorId: 'user_p1' }), update: async () => makeAsset({ status: 'recycled' }) },
    }, async ({ s }) => {
      const r = await s.recycleAsset('user_p1', 'asset_p1');
      expect(r).toBeTruthy();
    });
  });

  test('recycleAsset rejects non-author via Prisma', async () => {
    await withIsolatedPrisma({
      asset: { findUnique: async () => makeAsset({ authorId: 'other_user' }) },
    }, async ({ s }) => {
      await expect(s.recycleAsset('user_p1', 'asset_p1')).rejects.toThrow(/not your asset/i);
    });
  });

  test('getVersionHistory returns versions via Prisma', async () => {
    await withIsolatedPrisma({
      assetVersion: { findMany: async () => [{ id: 'v1', assetId: 'asset_p1', versionNo: 1, steps: [] }] },
    }, async ({ s }) => {
      const r = await s.getVersionHistory('asset_p1');
      expect(r.length).toBe(1);
    });
  });
});







describe('oauthService Prisma paths', () => {
  test('upsertUser finds existing user and updates', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../db/index.js', () => ({
        prisma: {
          user: {
            findUnique: async () => makeUser({ email: 'exist@gh.com', name: 'Old' }),
            update: async () => makeUser({ email: 'exist@gh.com', name: 'Updated' }),
          },
        },
        isMockMode: () => false,
        getPrisma: () => null,
      }));
      const o = (await import('../oauth/service.js')).oauthService;
      const r = await (o as any).upsertUser({ email: 'exist@gh.com', name: 'Updated' });
      expect(r.isNewUser).toBe(false);
      expect(r.user.email).toBe('exist@gh.com');
    });
  });

  test('upsertUser creates new user', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../db/index.js', () => ({
        prisma: {
          user: {
            findUnique: async () => null,
            create: async () => makeUser({ email: 'new@gh.com', name: 'New' }),
          },
        },
        isMockMode: () => false,
        getPrisma: () => null,
      }));
      const o = (await import('../oauth/service.js')).oauthService;
      const r = await (o as any).upsertUser({ email: 'new@gh.com', name: 'New' });
      expect(r.isNewUser).toBe(true);
      expect(r.user.email).toBe('new@gh.com');
    });
  });

  test('handleCallback flows through upsertUser', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../db/index.js', () => ({
        prisma: {
          user: {
            findUnique: async () => makeUser({ email: 'cb@gh.com' }),
            update: async () => makeUser({ email: 'cb@gh.com' }),
          },
        },
        isMockMode: () => false,
        getPrisma: () => null,
      }));
      const o = (await import('../oauth/service.js')).oauthService;
      const auth = o.buildAuthorizeUrl('github', 'http://localhost/cb');
      const r = await o.handleCallback('github', { code: 'test-code', state: auth.state, redirectUri: 'http://localhost/cb' });
      expect(r.authResponse.accessToken).toBeTruthy();
    });
  });

  test('handleCallback rejects invalid state', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../db/index.js', () => ({
        prisma: { user: { findUnique: async () => makeUser() } },
        isMockMode: () => false,
        getPrisma: () => null,
      }));
      const o = (await import('../oauth/service.js')).oauthService;
      await expect(o.handleCallback('github', { code: 'c', state: 'bad', redirectUri: 'http://localhost/cb' })).rejects.toThrow();
    });
  });

  test('buildAuthorizeUrl returns URL with state', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../db/index.js', () => ({
        prisma: null,
        isMockMode: () => false,
        getPrisma: () => null,
      }));
      const o = (await import('../oauth/service.js')).oauthService;
      const result = o.buildAuthorizeUrl('github', 'http://localhost/cb');
      expect(result.url).toContain('github.com');
      expect(result.state).toBeTruthy();
      expect(result.provider).toBe('github');
    });
  });
});
