/**
 * Crypto Utilities
 * Provides cryptographic functions for node authentication and message signing
 */

import * as crypto from 'crypto';
import { promisify } from 'util';

const randomBytes = promisify(crypto.randomBytes);
const scrypt = promisify(crypto.scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

/**
 * Generate a cryptographically secure node secret (64 characters)
 */
export function generateNodeSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random ID
 */
export function generateId(prefix?: string): string {
  const id = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Hash a secret with salt for storage
 */
export async function hashSecret(secret: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(secret, generatedSalt, 32);
  return {
    hash: hash.toString('hex'),
    salt: generatedSalt,
  };
}

/**
 * Verify a secret against a stored hash
 */
export async function verifySecret(secret: string, storedHash: string, salt: string): Promise<boolean> {
  try {
    const hash = await scrypt(secret, salt, 32);
    return hash.toString('hex') === storedHash;
  } catch {
    return false;
  }
}

/**
 * Create HMAC signature for message authentication
 */
export function createHmac(message: string, key: string): string {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmac(message: string, signature: string, key: string): boolean {
  const expected = createHmac(message, key);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Generate a SHA-256 hash of data
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a random verification code (numeric)
 */
export function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i] % 10];
  }
  return code;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptAes(data: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptAes(encrypted: string, key: Buffer, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
