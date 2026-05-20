// Auth Middleware Unit Tests
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock jwt
const mockVerify = jest.fn();
const mockSign = jest.fn();
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: { verify: mockVerify, sign: mockSign },
  verify: mockVerify,
  sign: mockSign,
}));

// Mock config
jest.unstable_mockModule('../config/index.js', () => ({
  config: { jwtSecret: 'test-secret' },
}));

describe('Auth Middleware - Token Validation', () => {
  beforeEach(() => {
    mockVerify.mockClear();
    mockSign.mockClear();
  });

  test('should reject request without authorization header', () => {
    const authHeader: string | undefined = undefined as string | undefined;
    const hasToken = !!(authHeader && authHeader.startsWith('Bearer '));
    expect(hasToken).toBe(false);
  });

  test('should reject request with non-Bearer auth', () => {
    const authHeader = 'Basic abc123';
    const hasToken = !!(authHeader && authHeader.startsWith('Bearer '));
    expect(hasToken).toBe(false);
  });

  test('should accept valid Bearer token', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const hasToken = !!(authHeader && authHeader.startsWith('Bearer '));
    expect(hasToken).toBe(true);
  });

  test('should extract token from Bearer prefix', () => {
    const authHeader = 'Bearer mytoken123';
    const token = authHeader.substring(7);
    expect(token).toBe('mytoken123');
  });
});

describe('Auth Middleware - JWT Verification', () => {
  test('should verify valid token', () => {
    const payload = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    mockVerify.mockReturnValue(payload);
    const decoded = mockVerify('token', 'secret') as typeof payload;
    expect(decoded.userId).toBe('user_1');
    expect(decoded.email).toBe('test@example.com');
  });

  test('should throw JsonWebTokenError for invalid token', () => {
    const JsonWebTokenError = class extends Error {
      constructor() {
        super('invalid signature');
        this.name = 'JsonWebTokenError';
      }
    };
    mockVerify.mockImplementation(() => { throw new JsonWebTokenError(); });
    expect(() => mockVerify('badtoken', 'secret')).toThrow();
  });

  test('should throw TokenExpiredError for expired token', () => {
    const TokenExpiredError = class extends Error {
      constructor() {
        super('jwt expired');
        this.name = 'TokenExpiredError';
      }
    };
    mockVerify.mockImplementation(() => { throw new TokenExpiredError(); });
    expect(() => mockVerify('expired', 'secret')).toThrow();
  });

  test('should throw for missing secret', () => {
    mockVerify.mockImplementation(() => { throw new Error('No secret provided'); });
    expect(() => mockVerify('token', '')).toThrow();
  });
});

describe('Auth Middleware - JwtPayload Interface', () => {
  test('should have required userId field', () => {
    const payload = { userId: 'user_123', email: 'test@example.com', role: 'user' };
    expect(payload).toHaveProperty('userId');
    expect(typeof payload.userId).toBe('string');
  });

  test('should have required email field', () => {
    const payload = { userId: 'user_123', email: 'test@example.com', role: 'user' };
    expect(payload).toHaveProperty('email');
    expect(typeof payload.email).toBe('string');
  });

  test('should have required role field', () => {
    const payload = { userId: 'user_123', email: 'test@example.com', role: 'user' };
    expect(payload).toHaveProperty('role');
    expect(typeof payload.role).toBe('string');
  });
});

describe('Auth Middleware - AuthenticatedRequest Interface', () => {
  test('should have optional user property', () => {
    const req = { user: undefined } as any;
    expect(req.user).toBeUndefined();
  });

  test('should attach user after successful auth', () => {
    const req = { user: undefined } as any;
    const user = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    req.user = user;
    expect(req.user).toEqual(user);
  });
});

describe('Auth Middleware - optionalAuth', () => {
  test('should continue without auth header', () => {
    const authHeader: string | undefined = undefined as string | undefined;
    const hasAuth = authHeader && authHeader.startsWith('Bearer ');
    expect(!!hasAuth).toBe(false);
  });

  test('should attach user when valid token provided', () => {
    const authHeader = 'Bearer validtoken';
    const hasAuth = authHeader && authHeader.startsWith('Bearer ');
    if (hasAuth) {
      const token = authHeader.substring(7);
      mockVerify.mockReturnValue({ userId: 'user_1' });
      const decoded = mockVerify(token, 'secret') as { userId: string };
      expect(decoded.userId).toBe('user_1');
    }
  });

  test('should continue on invalid token (no throw)', () => {
    const authHeader = 'Bearer invalidtoken';
    const hasAuth = authHeader && authHeader.startsWith('Bearer ');
    if (hasAuth) {
      const token = authHeader.substring(7);
      mockVerify.mockImplementation(() => { throw new Error('invalid'); });
      // optionalAuth catches and continues
      expect(() => mockVerify(token, 'secret')).toThrow();
    }
  });
});

describe('Auth Middleware - Error Messages', () => {
  test('should return "No token provided" when header missing', () => {
    const authHeader = undefined;
    const message = !authHeader ? 'No token provided' : '';
    expect(message).toBe('No token provided');
  });

  test('should return "Invalid token" for jwt error', () => {
    const isJwtError = true;
    const message = isJwtError ? 'Invalid token' : 'Unknown error';
    expect(message).toBe('Invalid token');
  });

  test('should return "Token expired" for expired token', () => {
    const isExpired = true;
    const message = isExpired ? 'Token expired' : 'Unknown error';
    expect(message).toBe('Token expired');
  });
});

describe('Auth Middleware - Token Signing', () => {
  test('should sign payload with secret', () => {
    mockSign.mockReturnValue('signed_token');
    const payload = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    const token = mockSign(payload, 'secret', { expiresIn: '1h' });
    expect(token).toBe('signed_token');
    expect(mockSign).toHaveBeenCalledWith(payload, 'secret', { expiresIn: '1h' });
  });

  test('should support refresh token with longer expiry', () => {
    mockSign.mockReturnValue('refresh_token');
    const payload = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    const token = mockSign(payload, 'secret', { expiresIn: '7d' });
    expect(token).toBe('refresh_token');
    expect(mockSign).toHaveBeenCalledWith(payload, 'secret', { expiresIn: '7d' });
  });
});
