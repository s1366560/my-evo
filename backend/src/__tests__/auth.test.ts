import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth/jwt.js';

describe('Auth Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('WrongPassword!', hash);
      expect(isValid).toBe(false);
    });
    
    it('should generate different hashes for same password', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('JWT Tokens', () => {
    const testPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    };
    
    it('should sign and verify token correctly', () => {
      const token = signToken(testPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });
    
    it('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid.token.here');
      }).toThrow();
    });
  });
});
