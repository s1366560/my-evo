/**
 * Deep Test Suite - Exception Handling (Part 1)
 */
import { describe, it, expect } from '@jest/globals';

class EvoMapError extends Error {
  constructor(public message: string, public code: string, public statusCode: number) {
    super(message); this.name = 'EvoMapError';
  }
}
class NotFoundError extends EvoMapError {
  constructor(r: string, id: string) { super(`${r} not found: ${id}`, 'NOT_FOUND', 404); }
}
class ValidationError extends EvoMapError {
  constructor(m: string) { super(m, 'VALIDATION_ERROR', 400); }
}
class UnauthorizedError extends EvoMapError {
  constructor(m = 'Auth required') { super(m, 'UNAUTHORIZED', 401); }
}
class ForbiddenError extends EvoMapError {
  constructor(m = 'Insufficient permissions') { super(m, 'FORBIDDEN', 403); }
}
class RateLimitError extends EvoMapError {
  constructor(m = 'Too many', public retryAfterSeconds = 60) { super(m, 'RATE_LIMITED', 429); }
}
class InsufficientCreditsError extends EvoMapError {
  constructor(required: number, available: number) {
    super(`Need ${required}, have ${available}`, 'INSUFFICIENT_CREDITS', 402);
  }
}
class QuarantineError extends EvoMapError {
  constructor(level: string) { super(`Node in ${level} quarantine`, 'NODE_QUARANTINED', 403); }
}
class ConflictError extends EvoMapError {
  constructor(m = 'Conflict') { super(m, 'CONFLICT', 409); }
}

describe('Deep Exception Tests', () => {
  describe('Error Classes', () => {
    it('EvoMapError properties', () => {
      const e = new EvoMapError('Test', 'TEST', 500);
      expect(e.message).toBe('Test'); expect(e.code).toBe('TEST'); expect(e.statusCode).toBe(500);
    });
    it('NotFoundError 404', () => {
      const e = new NotFoundError('User', 'u-1');
      expect(e.statusCode).toBe(404); expect(e.code).toBe('NOT_FOUND');
    });
    it('ValidationError 400', () => {
      expect(new ValidationError('bad').statusCode).toBe(400);
    });
    it('UnauthorizedError 401', () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
    });
    it('ForbiddenError 403', () => {
      expect(new ForbiddenError().statusCode).toBe(403);
    });
    it('RateLimitError 429 with retry', () => {
      const e = new RateLimitError('slow', 120);
      expect(e.statusCode).toBe(429); expect(e.retryAfterSeconds).toBe(120);
    });
    it('InsufficientCreditsError 402', () => {
      const e = new InsufficientCreditsError(100, 50);
      expect(e.statusCode).toBe(402); expect(e.message).toContain('100');
    });
    it('QuarantineError 403', () => {
      expect(new QuarantineError('high').statusCode).toBe(403);
    });
    it('ConflictError 409', () => {
      expect(new ConflictError().statusCode).toBe(409);
    });
  });

  describe('Validation Patterns', () => {
    const validateRequired = (obj: Record<string, unknown>, f: string) => {
      if (!obj[f]) throw new ValidationError(`${f} required`);
    };
    const validateRange = (v: number, min: number, max: number) => {
      if (v < min || v > max) throw new ValidationError(`Must be ${min}-${max}`);
    };
    const validatePattern = (v: string, p: RegExp) => {
      if (!p.test(v)) throw new ValidationError('Invalid format');
    };

    it('required validation', () => {
      expect(() => validateRequired({}, 'name')).toThrow();
      expect(() => validateRequired({ name: 'x' }, 'name')).not.toThrow();
    });
    it('range validation', () => {
      expect(() => validateRange(-1, 0, 100)).toThrow();
      expect(() => validateRange(50, 0, 100)).not.toThrow();
    });
    it('pattern validation', () => {
      const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(() => validatePattern('bad', email)).toThrow();
      expect(() => validatePattern('a@b.com', email)).not.toThrow();
    });
  });

  describe('Recovery Patterns', () => {
    it('retry succeeds after transient failures', async () => {
      let attempts = 0;
      const flaky = async () => { attempts++; if (attempts < 3) throw new Error('Transient'); return 'ok'; };
      const withRetry = async (fn: () => Promise<string>, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try { return await fn(); } catch { if (i === retries - 1) throw new Error('Failed'); }
        }
        throw new Error('Failed');
      };
      expect(await withRetry(flaky)).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('timeout handles slow operations', async () => {
      const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('Timeout') as T), ms))]);
      const slow = new Promise<string>(r => setTimeout(() => r('done'), 1000));
      await expect(withTimeout(slow, 100)).rejects.toThrow('Timeout');
    });
  });
});
