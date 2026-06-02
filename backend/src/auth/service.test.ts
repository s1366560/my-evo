// Auth service tests — register, login, refresh, password reset flows in mock mode.
// Complements the existing password-reset.test.ts and auth.test.ts by exercising
// the service surface against the real mockStore rather than bare mocks.
import { describe, test, expect, beforeEach, beforeAll } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { mockStore } from '../db/mock-store.js';
import { authService } from './service.js';
import { HttpError } from '../middleware/errorHandler.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

beforeAll(() => {
  // Force mock mode for this test file
  delete process.env.DATABASE_URL;
});

describe('AuthService (mock mode, real store)', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe('register', () => {
    test('creates a new user and returns JWT tokens', async () => {
      const result = await authService.register({
        email: 'alice@example.com',
        password: 'Secret123!',
        name: 'Alice',
      });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('alice@example.com');
      expect(result.user.name).toBe('Alice');
      expect(result.user.role).toBe('user');
      expect(result.user.credits).toBe(0);
      // The created user must be findable in the store
      const found = await mockStore.findUserByEmail('alice@example.com');
      expect(found).toBeTruthy();
      expect(found!.name).toBe('Alice');
    });

    test('rejects duplicate email', async () => {
      await authService.register({ email: 'dup@example.com', password: 'Secret123!', name: 'One' });
      await expect(
        authService.register({ email: 'dup@example.com', password: 'Secret123!', name: 'Two' })
      ).rejects.toThrow(/already registered/i);
    });

    test('persists hashed password, never the plaintext', async () => {
      await authService.register({ email: 'hashy@example.com', password: 'Plaintext!', name: 'Hashy' });
      const u = await mockStore.findUserByEmail('hashy@example.com');
      expect(u!.password).not.toBe('Plaintext!');
      const matches = await bcrypt.compare('Plaintext!', u!.password);
      expect(matches).toBe(true);
    });
  });

  describe('login', () => {
    let userId: string;
    beforeEach(async () => {
      const r = await authService.register({ email: 'login@example.com', password: 'LoginPass1!', name: 'Login User' });
      userId = r.user.id;
    });

    test('returns a fresh token pair on successful login', async () => {
      const result = await authService.login({ email: 'login@example.com', password: 'LoginPass1!' });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.id).toBe(userId);
    });

    test('rejects login with wrong password (401)', async () => {
      await expect(
        authService.login({ email: 'login@example.com', password: 'WrongPass1!' })
      ).rejects.toThrow(/invalid credentials/i);
    });

    test('rejects login with unknown email (401)', async () => {
      await expect(
        authService.login({ email: 'nope@example.com', password: 'WhoCares1!' })
      ).rejects.toThrow(/invalid credentials/i);
    });
  });

  describe('refreshToken', () => {
    test('returns a new access token for a valid refresh token', async () => {
      const r = await authService.register({ email: 'rt@example.com', password: 'RefTok123!', name: 'RT' });
      const result = await authService.refreshToken(r.refreshToken);
      expect(result.accessToken).toBeTruthy();
      // The new access token must be a valid JWT with the same userId
      const decoded = jwt.verify(result.accessToken, config.jwtSecret) as any;
      expect(decoded.userId).toBe(r.user.id);
    });

    test('rejects an invalid refresh token (401)', async () => {
      await expect(
        authService.refreshToken('not.a.valid.jwt')
      ).rejects.toThrow(/invalid refresh token/i);
    });

    test('rejects a refresh token for a missing user (401)', async () => {
      const r = await authService.register({ email: 'gone@example.com', password: 'Gone123!', name: 'Gone' });
      // Wipe the user from the store; refresh should now fail
      const u = await mockStore.findUserByEmail('gone@example.com');
      (mockStore as any).users.delete(u!.id);
      await expect(
        authService.refreshToken(r.refreshToken)
      ).rejects.toThrow(/invalid refresh token|user not found/i);
    });
  });

  describe('forgotPassword (mock mode)', () => {
    test('issues a token for a known email and stores it hashed', async () => {
      await authService.register({ email: 'fp@example.com', password: 'ForgPass1!', name: 'FP' });
      const r = await authService.forgotPassword('fp@example.com');
      expect(r.resetToken).toBeTruthy();
      const [recordId] = (r.resetToken as string).split('.');
      const stored = await mockStore.findPasswordResetToken(recordId);
      expect(stored).toBeTruthy();
      // The stored hash must not contain the plaintext
      expect(stored!.tokenHash).not.toContain('ForgPass1!');
    });

    test('returns null token for unknown email but still surfaces expiresAt', async () => {
      const r = await authService.forgotPassword('ghost@example.com');
      expect(r.resetToken).toBeNull();
      expect(r.expiresAt).toBeInstanceOf(Date);
    });

    test('deletes pre-existing tokens for the user before issuing a new one', async () => {
      await authService.register({ email: 'multi@example.com', password: 'MultPass1!', name: 'M' });
      const first = await authService.forgotPassword('multi@example.com');
      const second = await authService.forgotPassword('multi@example.com');
      const [firstId] = (first.resetToken as string).split('.');
      const [secondId] = (second.resetToken as string).split('.');
      expect(firstId).not.toBe(secondId);
      const oldStill = await mockStore.findPasswordResetToken(firstId);
      expect(oldStill).toBeNull();
      const newStored = await mockStore.findPasswordResetToken(secondId);
      expect(newStored).toBeTruthy();
    });
  });

  describe('resetPassword (mock mode)', () => {
    test('rejects empty token', async () => {
      await expect(authService.resetPassword('', 'NewPass1!')).rejects.toThrow(/token/i);
    });

    test('rejects token with bad format (no dot)', async () => {
      await authService.register({ email: 'rfmt@example.com', password: 'OldPass123!', name: 'R' });
      // Plain (no dot) — the service falls back to hash-lookup
      await expect(
        authService.resetPassword('definitely-not-a-token', 'NewPass1!')
      ).rejects.toThrow(/invalid or expired/i);
    });

    test('rejects weak new password (< 8 chars)', async () => {
      await authService.register({ email: 'weakpw@example.com', password: 'OldPass123!', name: 'W' });
      const issued = await authService.forgotPassword('weakpw@example.com');
      await expect(
        authService.resetPassword(issued.resetToken as string, 'short')
      ).rejects.toThrow(/at least 8 characters/i);
    });

    test('successfully resets and persists new password hash', async () => {
      await authService.register({ email: 'success@example.com', password: 'OldPass123!', name: 'S' });
      const issued = await authService.forgotPassword('success@example.com');
      const result = await authService.resetPassword(issued.resetToken as string, 'BrandNew123!');
      expect(result.userId).toBeTruthy();
      const u = await mockStore.findUserByEmail('success@example.com');
      const oldMatches = await bcrypt.compare('OldPass123!', u!.password);
      const newMatches = await bcrypt.compare('BrandNew123!', u!.password);
      expect(oldMatches).toBe(false);
      expect(newMatches).toBe(true);
    });

    test('rejects an already-used reset token (single-use)', async () => {
      await authService.register({ email: 'single@example.com', password: 'OldPass123!', name: 'U' });
      const issued = await authService.forgotPassword('single@example.com');
      await authService.resetPassword(issued.resetToken as string, 'FirstNew1!');
      await expect(
        authService.resetPassword(issued.resetToken as string, 'SecondNew1!')
      ).rejects.toThrow(/already been used|invalid or expired/i);
    });

    test('rejects an expired reset token', async () => {
      await authService.register({ email: 'exp@example.com', password: 'OldPass123!', name: 'E' });
      const issued = await authService.forgotPassword('exp@example.com');
      const [recordId] = (issued.resetToken as string).split('.');
      const rec = await mockStore.findPasswordResetToken(recordId);
      expect(rec).toBeTruthy();
      // Force the expiry into the past via the internal store
      (mockStore as any).passwordResetTokens.set(recordId, { ...rec, expiresAt: new Date(Date.now() - 1000) });
      await expect(
        authService.resetPassword(issued.resetToken as string, 'NewPass1!')
      ).rejects.toThrow(/expired|invalid/i);
    });

    test('rejects when the underlying user is missing (500)', async () => {
      await authService.register({ email: 'orphan@example.com', password: 'OldPass123!', name: 'O' });
      const issued = await authService.forgotPassword('orphan@example.com');
      const [recordId] = (issued.resetToken as string).split('.');
      // Delete user, but leave the reset token record
      const u = await mockStore.findUserByEmail('orphan@example.com');
      (mockStore as any).users.delete(u!.id);
      await expect(
        authService.resetPassword(issued.resetToken as string, 'NewPass1!')
      ).rejects.toThrow(/no longer exists/i);
    });

    test('falls back to hash lookup when record id is empty (legacy path)', async () => {
      await authService.register({ email: 'legacy@example.com', password: 'OldPass123!', name: 'L' });
      const issued = await authService.forgotPassword('legacy@example.com');
      // Take just the plain half (no record id) — this triggers the legacy branch
      const [_, plain] = (issued.resetToken as string).split('.');
      const result = await authService.resetPassword(plain, 'LegacyNew1!');
      expect(result.userId).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth controller tests — exercises each handler through an in-process Express
// app that mounts the auth controller methods directly on routes.
import express from 'express';
import http from 'node:http';
import { authController } from './controller.js';

function buildAuthApp() {
  const app = express();
  app.use(express.json());
  const r = express.Router();
  r.post('/register', (req, res, next) => authController.register(req, res, next));
  r.post('/login', (req, res, next) => authController.login(req, res, next));
  r.post('/refresh', (req, res, next) => authController.refreshToken(req, res, next));
  r.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
  r.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));
  app.use('/api/v1/auth', r);
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { port, close: () => server.close() };
}

function authReq(opts: { port: number; method: string; path: string; body?: unknown }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = opts.body !== undefined ? JSON.stringify(opts.body) : null;
    const r = http.request({
      hostname: '127.0.0.1', port: opts.port, path: opts.path, method: opts.method,
      headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let body: any = text;
        try { body = JSON.parse(text); } catch { /* keep text */ }
        resolve({ status: res.statusCode || 0, body });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

describe('Auth controller (HTTP)', () => {
  let port: number; let close: () => void;
  beforeEach(() => { mockStore.clear(); const t = buildAuthApp(); port = t.port; close = t.close; });
  afterEach(() => close());

  test('POST /register creates a new user (201)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'a@e.com', password: 'Password123!', name: 'A' } });
    expect(r.status).toBe(201);
    expect(r.body.data.user.email).toBe('a@e.com');
    expect(r.body.data.accessToken).toBeTruthy();
  });

  test('POST /register rejects missing email (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { password: 'Password123!' } });
    expect(r.status).toBe(400);
  });

  test('POST /register rejects missing password (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'a@e.com' } });
    expect(r.status).toBe(400);
  });

  test('POST /register rejects short password (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'a@e.com', password: 'short' } });
    expect(r.status).toBe(400);
  });

  test('POST /login authenticates a user (200)', async () => {
    await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'l@e.com', password: 'Password123!', name: 'L' } });
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/login', body: { email: 'l@e.com', password: 'Password123!' } });
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
  });

  test('POST /login rejects missing fields (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/login', body: { email: 'l@e.com' } });
    expect(r.status).toBe(400);
  });

  test('POST /login fails on wrong password (401)', async () => {
    await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'l@e.com', password: 'Password123!', name: 'L' } });
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/login', body: { email: 'l@e.com', password: 'WrongPassword123!' } });
    expect(r.status).toBe(401);
  });

  test('POST /refresh issues a new access token (200)', async () => {
    const reg = await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'r@e.com', password: 'Password123!', name: 'R' } });
    const refreshToken = reg.body.data.refreshToken;
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/refresh', body: { refreshToken } });
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
  });

  test('POST /refresh rejects missing token (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/refresh', body: {} });
    expect(r.status).toBe(400);
  });

  test('POST /forgot-password returns 202 (mock mode surfaces token)', async () => {
    await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'f@e.com', password: 'Password123!', name: 'F' } });
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/forgot-password', body: { email: 'f@e.com' } });
    expect(r.status).toBe(202);
    expect(r.body.data.message).toBeTruthy();
  });

  test('POST /forgot-password does not leak whether email exists', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/forgot-password', body: { email: 'nope@e.com' } });
    expect(r.status).toBe(202);
  });

  test('POST /forgot-password rejects missing email (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/forgot-password', body: {} });
    expect(r.status).toBe(400);
  });

  test('POST /reset-password with valid token resets password (200)', async () => {
    await authReq({ port, method: 'POST', path: '/api/v1/auth/register', body: { email: 'p@e.com', password: 'Password123!', name: 'P' } });
    const forgot = await authReq({ port, method: 'POST', path: '/api/v1/auth/forgot-password', body: { email: 'p@e.com' } });
    const token = forgot.body.data.resetToken;
    expect(token).toBeTruthy();
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/reset-password', body: { token, password: 'NewPassword123!' } });
    expect(r.status).toBe(200);
    expect(r.body.data.userId).toBeTruthy();
  });

  test('POST /reset-password rejects missing fields (400)', async () => {
    const r = await authReq({ port, method: 'POST', path: '/api/v1/auth/reset-password', body: { token: 'x' } });
    expect(r.status).toBe(400);
  });
});
