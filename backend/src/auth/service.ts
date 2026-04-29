import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isMockMode, mockStore } from '../db/index.js';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { RegisterDto, LoginDto, AuthResponse, TokenPayload } from './types.js';

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
