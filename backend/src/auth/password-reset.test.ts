// Password reset service tests
// Covers: token issuance, token expiry, single-use enforcement, weak password
// rejection, unknown email no-op.
import { describe, test, expect, beforeEach } from '@jest/globals';
import { mockStore } from '../db/mock-store.js';
import bcrypt from 'bcryptjs';

describe('PasswordResetService (mock mode)', () => {
  beforeEach(async () => {
    mockStore.clear();
    // Seed a user via the same hash style as production
    const hashed = await bcrypt.hash('oldPassword123', 4);
    await mockStore.createUser({
      email: 'reset-target@example.com',
      password: hashed,
      name: 'Reset Target',
      level: 1, reputation: 0, credits: 0,
    });
  });

  test('issues a reset token for a known email (issuance)', async () => {
    // Ensure we are in mock mode (no DATABASE_URL exported)
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const result = await authService.forgotPassword('reset-target@example.com');
      expect(result.resetToken).toBeTruthy();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // Format: "<id>.<hex>"
      const parts = (result.resetToken as string).split('.');
      expect(parts.length).toBe(2);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('returns null token for unknown email (no enumeration)', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const result = await authService.forgotPassword('nope@example.com');
      expect(result.resetToken).toBeNull();
      // Still surfaces an expiry so callers cannot infer anything
      expect(result.expiresAt).toBeInstanceOf(Date);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('rejects reset with a too-short password (weak password rejection)', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const issued = await authService.forgotPassword('reset-target@example.com');
      expect(issued.resetToken).toBeTruthy();
      await expect(
        authService.resetPassword(issued.resetToken as string, 'short')
      ).rejects.toThrow(/at least 8 characters/);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('consumes the token exactly once (single-use enforcement)', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const issued = await authService.forgotPassword('reset-target@example.com');
      const token = issued.resetToken as string;
      const ok = await authService.resetPassword(token, 'BrandNewPass1!');
      expect(ok.userId).toBeTruthy();
      // Second use must fail
      await expect(
        authService.resetPassword(token, 'AnotherPass1!')
      ).rejects.toThrow(/already been used|Invalid or expired/);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('rejects an expired token (token expiry)', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const issued = await authService.forgotPassword('reset-target@example.com');
      expect(issued.resetToken).toBeTruthy();
      const [recordId] = (issued.resetToken as string).split('.');
      // Find the token record and force its expiry into the past
      const record = await mockStore.findPasswordResetToken(recordId);
      expect(record).toBeTruthy();
      record!.expiresAt = new Date(Date.now() - 1000);
      await mockStore.markPasswordResetTokenUsed; // noop touch
      // Re-mutate directly: we used update through mark — but easier: just replace
      const store = mockStore as any;
      store.passwordResetTokens.set(recordId, { ...record, expiresAt: new Date(Date.now() - 1000) });
      await expect(
        authService.resetPassword(issued.resetToken as string, 'NewSecurePass1!')
      ).rejects.toThrow(/expired|Invalid/);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('changing password via reset actually changes the stored hash', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      const issued = await authService.forgotPassword('reset-target@example.com');
      await authService.resetPassword(issued.resetToken as string, 'CompletelyNew123!');
      const user = await mockStore.findUserByEmail('reset-target@example.com');
      expect(user).toBeTruthy();
      const oldMatches = await bcrypt.compare('oldPassword123', user!.password);
      const newMatches = await bcrypt.compare('CompletelyNew123!', user!.password);
      expect(oldMatches).toBe(false);
      expect(newMatches).toBe(true);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });

  test('rejects empty or missing token', async () => {
    const wasDb = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { authService } = await import('./service.js');
      await expect(authService.resetPassword('', 'ValidPass123!')).rejects.toThrow(/token/i);
    } finally {
      if (wasDb) process.env.DATABASE_URL = wasDb;
    }
  });
});
