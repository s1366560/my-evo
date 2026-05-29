// Custom error classes for the application

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_CREDITS', 402, details);
    this.name = 'InsufficientCreditsError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', retryAfter?: number) {
    super(message, 'SERVICE_UNAVAILABLE', 503, { retryAfter });
    this.name = 'ServiceUnavailableError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BAD_REQUEST', 400, details);
    this.name = 'BadRequestError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 'INTERNAL_ERROR', 500);
    this.name = 'InternalServerError';
  }
}

export class TrustLevelError extends AppError {
  constructor(message = 'Insufficient trust level') {
    super(message, 'TRUST_LEVEL_ERROR', 403);
    this.name = 'TrustLevelError';
  }
}

export class QuarantineError extends AppError {
  constructor(message = 'Node is under quarantine') {
    super(message, 'QUARANTINE_ERROR', 403);
    this.name = 'QuarantineError';
  }
}

// Alias for backwards compatibility
export const EvoMapError = AppError;
