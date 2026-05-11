import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  nodeId?: string;
}

export interface NodeJwtPayload {
  nodeId: string;
  secret: string;
}

// JWT utilities
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

export function signNodeToken(payload: NodeJwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '30d' as jwt.SignOptions['expiresIn'], // Node tokens last longer
  });
}

export function verifyNodeToken(token: string): NodeJwtPayload {
  return jwt.verify(token, config.jwt.secret) as NodeJwtPayload;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Node secret utilities
export function generateNodeSecret(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

export function hashNodeSecret(secret: string): string {
  return bcrypt.hashSync(secret, 10);
}

export function verifyNodeSecret(secret: string, hash: string): boolean {
  return bcrypt.compareSync(secret, hash);
}
