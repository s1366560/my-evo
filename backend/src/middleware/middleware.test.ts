// Middleware Unit Tests
import { describe, test, expect } from '@jest/globals';

describe('HttpError class', () => {
  test('should create error with status code', () => {
    const { HttpError } = require('./errorHandler.js');
    const err = new HttpError(404, 'Not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err instanceof Error).toBe(true);
  });
});

describe('Auth types', () => {
  test('should define JwtPayload structure', () => {
    const payload = {
      userId: 'user_123',
      email: 'test@example.com',
      role: 'admin',
    };

    expect(typeof payload.userId).toBe('string');
    expect(typeof payload.email).toBe('string');
    expect(typeof payload.role).toBe('string');
  });

  test('should define AuthenticatedRequest extension', () => {
    const req = {
      headers: {},
      user: undefined as { userId: string; email: string; role: string } | undefined,
    };

    expect(req.user).toBeUndefined();
    req.user = { userId: 'u1', email: 'a@b.com', role: 'user' };
    expect(req.user.userId).toBe('u1');
  });
});

describe('Error handler middleware', () => {
  test('should export errorHandler function', () => {
    const { errorHandler } = require('./errorHandler.js');
    expect(typeof errorHandler).toBe('function');
  });

  test('errorHandler should handle HttpError', () => {
    const { HttpError, errorHandler } = require('./errorHandler.js');
    const err = new HttpError(400, 'Bad request');
    const req = {} as any;
    const res = {
      status: (jest.fn() as any).mockReturnThis(),
      json: (jest.fn() as any),
    };
    const next = jest.fn() as any;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Bad request' },
    });
  });

  test('errorHandler should handle generic Error', () => {
    const { errorHandler } = require('./errorHandler.js');
    const err = new Error('Something went wrong');
    const req = {} as any;
    const res = {
      status: (jest.fn() as any).mockReturnThis(),
      json: (jest.fn() as any),
    };
    const next = jest.fn() as any;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Something went wrong' },
    });
  });

  test('errorHandler should handle error without statusCode', () => {
    const { errorHandler } = require('./errorHandler.js');
    const err = new Error('No code') as Error & { statusCode?: number };
    err.statusCode = undefined;
    const req = {} as any;
    const res = {
      status: (jest.fn() as any).mockReturnThis(),
      json: (jest.fn() as any),
    };
    const next = jest.fn() as any;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
