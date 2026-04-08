export class EvoMapError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'EvoMapError';
  }
}

export class NotFoundError extends EvoMapError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends EvoMapError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends EvoMapError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationError extends EvoMapError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class RateLimitError extends EvoMapError {
  constructor(
    message = 'Too many requests',
    public readonly retryAfterSeconds = 60,
  ) {
    super(message, 'RATE_LIMITED', 429);
  }
}

export class InsufficientCreditsError extends EvoMapError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
      'INSUFFICIENT_CREDITS',
      402,
    );
  }
}

export class QuarantineError extends EvoMapError {
  constructor(level: string) {
    super(`Node is in ${level} quarantine`, 'NODE_QUARANTINED', 403);
  }
}

export class SimilarityViolationError extends EvoMapError {
  constructor(score: number) {
    super(
      `Asset similarity exceeds threshold: ${score.toFixed(2)}`,
      'SIMILARITY_VIOLATION',
      409,
    );
  }
}

export class TrustLevelError extends EvoMapError {
  constructor(required: string, current: string) {
    super(
      `Trust level ${required} required, current: ${current}`,
      'TRUST_LEVEL_INSUFFICIENT',
      403,
    );
  }
}

export class KeyInceptionError extends EvoMapError {
  constructor() {
    super('API keys cannot create other API keys', 'KEY_INCEPTION_BLOCKED', 403);
  }
}

export class ConflictError extends EvoMapError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', 409);
  }
}
