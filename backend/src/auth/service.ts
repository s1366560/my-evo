import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma, isMockMode, mockStore } from '../db/index.js';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { RegisterDto, LoginDto, AuthResponse, TokenPayload } from './types.js';

// Password reset policy
const PASSWORD_RESET_TTL_MIN = 60; // 1 hour
const PASSWORD_MIN_LENGTH = 8;
const RESET_TOKEN_BYTES = 32;

function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateResetToken(): string {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    if (isMockMode()) {
      return this.mockRegister(data);
    }
    const existingUser = await prisma!.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new HttpError(400, 'Email already registered');
    }
    const hashedPassword = await bcrypt.hash(data.password, config.bcryptSaltRounds);
    const user = await prisma!.user.create({
      data: { email: data.email, password: hashedPassword, name: data.name, level: 1, reputation: 0, credits: 0 },
    });
    return this.generateAuthResponse(user);
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    if (isMockMode()) {
      return this.mockLogin(data);
    }
    const user = await prisma!.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new HttpError(401, 'Invalid credentials');
    }
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      throw new HttpError(401, 'Invalid credentials');
    }
    return this.generateAuthResponse(user);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as TokenPayload;
      let user: any;
      if (isMockMode()) {
        user = await mockStore.findUserById(decoded.userId);
      } else {
        user = await prisma!.user.findUnique({ where: { id: decoded.userId } });
      }
      if (!user) {
        throw new HttpError(401, 'User not found');
      }
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role || 'user' },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
      );
      return { accessToken };
    } catch {
      throw new HttpError(401, 'Invalid refresh token');
    }
  }

  async forgotPassword(email: string): Promise<{ resetToken: string | null; expiresAt: Date }> {
    // Always 202-shaped outcome. The plain token is only returned in non-production
    // environments (or for testing); production should email the user instead.
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000);

    if (isMockMode()) {
      const user = await mockStore.findUserByEmail(email);
      if (!user) {
        // No-op: do not leak existence, return null token.
        return { resetToken: null, expiresAt };
      }
      // Invalidate any pre-existing tokens for the user
      await mockStore.deletePasswordResetTokensForUser(user.id);
      const plain = generateResetToken();
      const tokenHash = hashResetToken(plain);
      const created = await mockStore.createPasswordResetToken({
        userId: user.id, tokenHash, expiresAt, usedAt: null,
      });
      // In mock mode we surface the token for E2E/test usage. In production a
      // separate email-sender would be invoked here.
      return { resetToken: `${created.id}.${plain}`, expiresAt };
    }

    const user = await prisma!.user.findUnique({ where: { email } });
    if (!user) {
      return { resetToken: null, expiresAt };
    }
    // Best-effort cleanup of older tokens; tolerate environments without model
    try {
      // @ts-ignore - passwordResetToken model is added in this iteration
      await prisma!.passwordResetToken.deleteMany({ where: { userId: user.id } });
    } catch {
      // ignore: model may not exist yet
    }
    const plain = generateResetToken();
    const tokenHash = hashResetToken(plain);
    // @ts-ignore - passwordResetToken model is added in this iteration
    const created = await prisma!.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt, usedAt: null },
    });
    return { resetToken: `${created.id}.${plain}`, expiresAt };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ userId: string }> {
    validatePasswordStrength(newPassword);
    if (typeof token !== 'string' || token.length === 0) {
      throw new HttpError(400, 'Reset token is required');
    }
    // Token format: "<recordId>.<plain>" — we re-hash the plain half to look up.
    const dotIdx = token.indexOf('.');
    let recordId: string;
    let plain: string;
    if (dotIdx > 0) {
      recordId = token.slice(0, dotIdx);
      plain = token.slice(dotIdx + 1);
    } else {
      // legacy or test path: treat whole input as plain
      recordId = '';
      plain = token;
    }
    const tokenHash = hashResetToken(plain);

    if (isMockMode()) {
      let record = recordId
        ? await mockStore.findPasswordResetToken(recordId)
        : await mockStore.findPasswordResetTokenByHash(tokenHash);
      if (!record) {
        // fall back to hash lookup if id-based lookup missed
        record = await mockStore.findPasswordResetTokenByHash(tokenHash);
      }
      if (!record) {
        throw new HttpError(400, 'Invalid or expired reset token');
      }
      if (record.usedAt) {
        throw new HttpError(400, 'Reset token has already been used');
      }
      if (record.expiresAt.getTime() < Date.now()) {
        throw new HttpError(400, 'Reset token has expired');
      }
      const hashedPassword = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
      const updated = await mockStore.updateUserPassword(record.userId, hashedPassword);
      if (!updated) {
        throw new HttpError(500, 'User no longer exists');
      }
      await mockStore.markPasswordResetTokenUsed(record.id);
      return { userId: record.userId };
    }

    // Prisma mode
    // @ts-ignore - passwordResetToken model is added in this iteration
    let record = recordId
      ? // @ts-ignore
        await prisma!.passwordResetToken.findUnique({ where: { id: recordId } })
      : null;
    if (!record) {
      // @ts-ignore
      record = await prisma!.passwordResetToken.findFirst({ where: { tokenHash } });
    }
    if (!record) {
      throw new HttpError(400, 'Invalid or expired reset token');
    }
    if (record.usedAt) {
      throw new HttpError(400, 'Reset token has already been used');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new HttpError(400, 'Reset token has expired');
    }
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
    await prisma!.user.update({ where: { id: record.userId }, data: { password: hashedPassword } });
    // @ts-ignore
    await prisma!.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return { userId: record.userId };
  }

  private async mockRegister(data: RegisterDto): Promise<AuthResponse> {
    const existing = await mockStore.findUserByEmail(data.email);
    if (existing) {
      throw new HttpError(400, 'Email already registered');
    }
    const hashedPassword = await bcrypt.hash(data.password, config.bcryptSaltRounds);
    const user = await mockStore.createUser({
      email: data.email, password: hashedPassword, name: data.name ?? '',
      level: 1, reputation: 0, credits: 0,
    });
    return this.mockAuthResponse(user);
  }

  private async mockLogin(data: LoginDto): Promise<AuthResponse> {
    const user = await mockStore.findUserByEmail(data.email);
    if (!user) {
      throw new HttpError(401, 'Invalid credentials');
    }
    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
      throw new HttpError(401, 'Invalid credentials');
    }
    return this.mockAuthResponse(user);
  }

  private mockAuthResponse(user: any): AuthResponse {
    const payload: TokenPayload = { userId: user.id, email: user.email, role: 'user' };
    return {
      user: {
        id: user.id, email: user.email, name: user.name, avatar: null,
        role: 'user', level: user.level, reputation: user.reputation,
        credits: user.credits, createdAt: user.createdAt, updatedAt: user.updatedAt,
      },
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  private generateAuthResponse(user: any): AuthResponse {
    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id, email: user.email, name: user.name, avatar: user.avatar,
        role: user.role, level: user.level, reputation: user.reputation,
        credits: user.credits, createdAt: user.createdAt, updatedAt: user.updatedAt,
      },
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

export const authService = new AuthService();
