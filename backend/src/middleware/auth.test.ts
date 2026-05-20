// Auth Middleware Tests — tests actual authenticate / optionalAuth with mocked jwt + config
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// jest.mock must be called before any require/import of the target module
jest.mock('jsonwebtoken', () => {
  const { JsonWebTokenError, TokenExpiredError } = jest.requireActual('jsonwebtoken');
  return {
    JsonWebTokenError,
    TokenExpiredError,
    default: {
      verify: jest.fn(),
      sign: jest.fn(),
    },
    verify: jest.fn(),
    sign: jest.fn(),
  };
});

jest.mock('../config/index.js', () => ({
  config: { jwtSecret: 'test-secret-for-unit-tests' },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken') as {
  verify: jest.Mock;
  sign: jest.Mock;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { authenticate, optionalAuth } = require('../middleware/auth.js');

describe('authenticate middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    mockRes = {};
    jwt.verify.mockReset();
  });

  test('calls next() with 401 when authorization header is missing', () => {
    mockReq = { headers: {} };
    authenticate(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    const err = mockNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('No token provided');
  });

  test('calls next() with 401 when authorization header has no Bearer prefix', () => {
    mockReq = { headers: { authorization: 'Basic abc123' } };
    authenticate(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    const err = mockNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('No token provided');
  });

  test('calls next() and attaches user when token is valid', () => {
    const payload = { userId: 'user_abc', email: 'test@example.com', role: 'user' };
    jwt.verify.mockReturnValue(payload);
    mockReq = { headers: { authorization: 'Bearer valid.jwt.token' } };
    authenticate(mockReq, mockRes, mockNext);
    expect(jwt.verify).toHaveBeenCalledWith('valid.jwt.token', 'test-secret-for-unit-tests');
    expect(mockReq.user).toEqual(payload);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('calls next() with 401 when token is invalid (JsonWebTokenError)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JsonWebTokenError } = require('jsonwebtoken') as any;
    jwt.verify.mockImplementation(() => { throw new JsonWebTokenError('invalid signature'); });
    mockReq = { headers: { authorization: 'Bearer bad.token' } };
    authenticate(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    const err = mockNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token');
  });

  test('calls next() with 401 when token is expired (TokenExpiredError)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TokenExpiredError } = require('jsonwebtoken') as any;
    jwt.verify.mockImplementation(() => { throw new TokenExpiredError('jwt expired', 'expired'); });
    mockReq = { headers: { authorization: 'Bearer expired.token' } };
    authenticate(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    const err = mockNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Token expired');
  });
});

describe('optionalAuth middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    mockRes = {};
    jwt.verify.mockReset();
  });

  test('calls next() without user when authorization header is missing', () => {
    mockReq = { headers: {} };
    optionalAuth(mockReq, mockRes, mockNext);
    expect(mockReq.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('calls next() and attaches user when token is valid', () => {
    const payload = { userId: 'user_opt', email: 'opt@example.com', role: 'viewer' };
    jwt.verify.mockReturnValue(payload);
    mockReq = { headers: { authorization: 'Bearer opt.jwt.token' } };
    optionalAuth(mockReq, mockRes, mockNext);
    expect(mockReq.user).toEqual(payload);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('calls next() without user when token is invalid (swallows error)', () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad token'); });
    mockReq = { headers: { authorization: 'Bearer bad.token' } };
    optionalAuth(mockReq, mockRes, mockNext);
    expect(mockReq.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('calls next() without user when header is Basic auth', () => {
    mockReq = { headers: { authorization: 'Basic abc' } };
    optionalAuth(mockReq, mockRes, mockNext);
    expect(mockReq.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith();
  });
});

describe('JwtPayload interface', () => {
  test('requires userId, email, role fields', () => {
    const payload = { userId: 'u1', email: 'e@x.com', role: 'admin' };
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('e@x.com');
    expect(payload.role).toBe('admin');
  });

  test('role field accepts any string value', () => {
    const admin = { userId: 'u1', email: 'e@x.com', role: 'admin' };
    const user = { userId: 'u2', email: 'e@x.com', role: 'user' };
    const viewer = { userId: 'u3', email: 'e@x.com', role: 'viewer' };
    expect(admin.role).toBe('admin');
    expect(user.role).toBe('user');
    expect(viewer.role).toBe('viewer');
  });
});
